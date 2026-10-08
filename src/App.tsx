import { useState, useEffect, useRef } from "react";
import {
  Clapperboard,
  Plus,
  Save,
  Download,
  Film,
  ChevronRight,
  Trash2,
  Copy,
  ArrowUp,
  ArrowDown,
  Check,
  FolderOpen,
} from "lucide-react";
import {
  analyze,
  continuity,
  csv,
  demoProject,
  emptyProject,
  fields,
  generateShots,
  newShot,
  shotColumns,
  timeline,
  uid,
  validateProject,
  type Project,
  type Shot,
  type AssetKind,
} from "./domain";
import { prompt, splitSegments } from "./prompts";
import { template as seedanceTemplate } from "./models/seedance";
import { template as wanTemplate } from "./models/wan";
const nav = [
  "项目工作台",
  "剧本管理",
  "剧本解析",
  "角色资产库",
  "场景资产库",
  "道具资产库",
  "智能分镜",
  "时间轴编辑",
  "视频提示词生成",
  "文件导出",
  "系统设置",
];
const storageKey = "ai-drama-studio-v1";
function load() {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return { projects: [demoProject()], error: "" };
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data) || !data.length)
      throw Error("项目列表为空或格式错误");
    return { projects: data.map(validateProject), error: "" };
  } catch (e) {
    return {
      projects: [demoProject()],
      error: `本地数据读取失败，已打开示例；原存储尚未覆盖。${String(e)}`,
    };
  }
}
function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const sizes = [
  "大远景",
  "远景",
  "全景",
  "中景",
  "近景",
  "特写",
  "大特写",
  "微距特写",
];
const positions = [
  "平视",
  "俯视",
  "仰视",
  "侧面",
  "背面",
  "过肩",
  "主观视角",
  "低机位",
  "高机位",
];
const movements = [
  "固定",
  "推镜",
  "拉镜",
  "横移",
  "跟拍",
  "摇镜",
  "环绕",
  "升降",
  "手持",
  "缓慢推进",
];
function Field({
  label,
  value,
  onChange,
  options,
  number = false,
}: {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  options?: string[];
  number?: boolean;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {options ? (
        <select
          aria-label={label}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          {options.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      ) : number ? (
        <input
          aria-label={label}
          type="number"
          min="0.1"
          max="3600"
          step="0.1"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <textarea
          aria-label={label}
          rows={String(value).length > 50 ? 3 : 1}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </label>
  );
}
export default function App() {
  const [initial] = useState(load);
  const [projects, setProjects] = useState<Project[]>(initial.projects);
  const [active, setActive] = useState(projects[0].id);
  const [page, setPage] = useState(0);
  const [message, setMessage] = useState(initial.error);
  const [allowSave, setAllowSave] = useState(!initial.error);
  const [selected, setSelected] = useState("");
  const [selectedAsset, setSelectedAsset] = useState("");
  const [chosen, setChosen] = useState<string[]>([]);
  const [promptEdited, setPromptEdited] = useState(
    Boolean(projects.find((x) => x.id === active)?.prompt),
  );
  const [rangeStart, setRangeStart] = useState(1);
  const [rangeEnd, setRangeEnd] = useState(projects[0].shots.length || 1);
  const fileRef = useRef<HTMLInputElement>(null);
  const txtRef = useRef<HTMLInputElement>(null);
  const p = projects.find((x) => x.id === active) || projects[0];
  const shot = p.shots.find((s) => s.id === selected);
  const kind: AssetKind =
    page === 3 ? "characters" : page === 4 ? "locations" : "props";
  const asset = p[kind].find((a) => a.id === selectedAsset);
  const ordered = p.shots.filter((s) => chosen.includes(s.id));
  const working = chosen.length ? ordered : p.shots;
  const generated = prompt(p, working);
  const output = promptEdited ? p.prompt : generated;
  const total = p.shots.reduce((a, s) => a + s.duration, 0);
  function update(change: Partial<Project>) {
    setProjects((all) =>
      all.map((x) =>
        x.id === p.id
          ? { ...x, ...change, updatedAt: new Date().toISOString() }
          : x,
      ),
    );
  }
  function save() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(projects));
      setAllowSave(true);
      setMessage("项目已保存到当前浏览器。建议定期导出 JSON 备份。");
    } catch (e) {
      setMessage(
        `保存失败：浏览器存储不可用或容量不足，请导出 JSON 备份。${String(e)}`,
      );
    }
  }
  useEffect(() => {
    if (!allowSave) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(projects));
    } catch {
      setMessage("自动保存失败：存储不可用或容量不足，请导出 JSON 备份。");
    }
  }, [projects, allowSave]);
  useEffect(() => {
    setSelected("");
    setSelectedAsset("");
    setChosen([]);
    setPromptEdited(Boolean(projects.find((x) => x.id === active)?.prompt));
  }, [active]);
  function changeShot(change: Partial<Shot>) {
    if (shot)
      update({
        shots: p.shots.map((s) => (s.id === shot.id ? { ...s, ...change } : s)),
      });
  }
  function move(id: string, offset: number) {
    const list = [...p.shots],
      i = list.findIndex((s) => s.id === id),
      j = i + offset;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    update({ shots: list });
  }
  function removeShot(id: string) {
    if (confirm("确定删除这个镜头？")) {
      update({ shots: p.shots.filter((s) => s.id !== id) });
      setChosen(chosen.filter((x) => x !== id));
    }
  }
  function generate() {
    if (
      p.shots.length &&
      !confirm(
        "重新生成将替换未确认镜头；已确认镜头会原样保留并置于前方。是否继续？",
      )
    )
      return;
    const locked = p.shots.filter((s) => s.confirmed);
    update({ shots: [...locked, ...generateShots(p)] });
    setMessage("已按剧本逐行规则拆分分镜，请精修动作、表情与站位。");
  }
  async function importJSON(file?: File) {
    if (!file) return;
    try {
      const imported = validateProject(JSON.parse(await file.text()));
      const restored = {
        ...imported,
        id: uid(),
        name: imported.name + "（恢复）",
      };
      setProjects((all) => [...all, restored]);
      setActive(restored.id);
      setAllowSave(true);
      setMessage("JSON 项目已恢复为独立副本。");
    } catch (e) {
      setMessage(`导入失败：${String(e)}。原项目未改变。`);
    }
    if (fileRef.current) fileRef.current.value = "";
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(output);
      setMessage("提示词已复制。");
    } catch {
      setMessage("浏览器不允许剪贴板访问，请在文本框中全选复制，或导出 TXT。");
    }
  }
  const toggle = (id: string) =>
    setChosen(
      chosen.includes(id) ? chosen.filter((x) => x !== id) : [...chosen, id],
    );
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <Clapperboard size={30} />
          <div>
            AI DRAMA<span>STUDIO / 制作工作台</span>
          </div>
        </div>
        <div className="workspace-label">
          WORKSPACE <span>V1.0</span>
        </div>
        <nav>
          {nav.map((n, i) => (
            <button
              key={n}
              onClick={() => {
                setPage(i);
                setSelectedAsset("");
              }}
              className={page === i ? "active" : ""}
            >
              <span className="nav-num">{String(i + 1).padStart(2, "0")}</span>
              {n}
              {page === i && <ChevronRight size={14} />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <span className="dot" /> 本地制作模式
          <p>
            规则解析 · 无付费 API
            <br />
            数据保存在当前浏览器
          </p>
        </div>
      </aside>
      <div className="workspace">
        <header>
          <div className="breadcrumb">
            制作空间 <ChevronRight size={14} /> <strong>{p.name}</strong>
          </div>
          <div className="header-actions">
            <span className="tag">LOCAL / 本地</span>
            <button onClick={save}>
              <Save size={15} />
              保存项目
            </button>
            <button
              className="primary"
              onClick={() => {
                setPage(9);
              }}
            >
              <Download size={15} />
              导出制作文件
            </button>
          </div>
        </header>
        <div className="toolbar">
          <div>
            <span className="eyebrow">PRODUCTION WORKBENCH</span>
            <h1>{nav[page]}</h1>
            <p>从剧本到镜头，把每一个创作决定变成可编辑的制作数据。</p>
          </div>
          <div className="project-select">
            <select
              aria-label="当前项目"
              value={p.id}
              onChange={(e) => setActive(e.target.value)}
            >
              {projects.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
            <button
              onClick={() => {
                const q = emptyProject("新项目");
                setProjects([...projects, q]);
                setActive(q.id);
                setPage(1);
              }}
            >
              <Plus size={16} />
              新建
            </button>
          </div>
        </div>
        {message && (
          <div className="notice" role="status">
            {message}
            <button onClick={() => setMessage("")}>关闭</button>
          </div>
        )}
        <div className="content-layout">
          <main>
            {page === 0 && (
              <>
                <div className="hero">
                  <div>
                    <span className="eyebrow">YOUR NEXT STORY STARTS HERE</span>
                    <h2>让故事，进入制作。</h2>
                    <p>
                      管理剧本、统一资产、规划镜头与连续视频提示词。
                      <br />
                      规则生成初稿，创作者掌握最终决定。
                    </p>
                    <button className="primary" onClick={() => setPage(1)}>
                      <Film size={16} />
                      打开剧本编辑器
                    </button>
                  </div>
                  <div className="hero-mark">
                    <Clapperboard size={85} />
                    <span>SCENE / TAKE / CREATE</span>
                  </div>
                </div>
                <div className="stats">
                  {[
                    ["场次", p.scenes.length],
                    ["角色资产", p.characters.length],
                    ["分镜数量", p.shots.length],
                    ["规划时长", `${total.toFixed(1)}s`],
                  ].map(([n, v]) => (
                    <div key={n}>
                      <span>{n}</span>
                      <strong>{v}</strong>
                    </div>
                  ))}
                </div>
                <section>
                  <div className="section-title">
                    <h3>项目管理</h3>
                    <button onClick={() => fileRef.current?.click()}>
                      <FolderOpen size={15} />
                      恢复 JSON
                    </button>
                  </div>
                  <Field
                    label="当前项目名称"
                    value={p.name}
                    onChange={(name) => update({ name })}
                  />
                  <div className="project-grid">
                    {projects.map((x) => (
                      <article key={x.id}>
                        <span className="eyebrow">LOCAL PROJECT</span>
                        <h3>{x.name}</h3>
                        <p>
                          {x.shots.length} 个镜头 ·{" "}
                          {new Date(x.updatedAt).toLocaleDateString("zh-CN")}
                        </p>
                        <button
                          onClick={() => {
                            setActive(x.id);
                            setPage(1);
                          }}
                        >
                          打开项目
                        </button>
                        <button
                          className="danger"
                          onClick={() => {
                            if (confirm(`删除「${x.name}」？请先备份。`)) {
                              const rest = projects.filter(
                                (a) => a.id !== x.id,
                              );
                              setProjects(
                                rest.length ? rest : [emptyProject()],
                              );
                              if (x.id === active) setActive(rest[0]?.id || "");
                            }
                          }}
                        >
                          <Trash2 size={14} />
                          删除
                        </button>
                      </article>
                    ))}
                  </div>
                  <button
                    onClick={() => {
                      const q = demoProject();
                      setProjects([...projects, q]);
                      setActive(q.id);
                    }}
                  >
                    添加完整示例项目
                  </button>
                </section>
              </>
            )}
            {page === 1 && (
              <section>
                <div className="section-title">
                  <h3>剧本编辑器</h3>
                  <div>
                    <button onClick={() => txtRef.current?.click()}>
                      导入 TXT
                    </button>
                    <button onClick={save}>保存草稿</button>
                    <button
                      className="primary"
                      onClick={() => {
                        update(analyze(p));
                        setPage(2);
                        setMessage(
                          "已执行规则解析，资产按名称合并；现有分镜保持不变。",
                        );
                      }}
                    >
                      规则解析剧本
                    </button>
                  </div>
                </div>
                <p className="hint">
                  建议格式：第1集 / 场次1 内景 咖啡馆 夜 / 出场人物：林舟、苏晴
                  / 林舟：对白。未识别信息请手动修正。DOCX、PDF 尚未支持。
                </p>
                <textarea
                  className="script-editor"
                  aria-label="原始剧本"
                  value={p.script}
                  onChange={(e) => update({ script: e.target.value })}
                  placeholder="在此粘贴或编写剧本…"
                />
                <div className="bottom-line">
                  原始剧本完整保留 <span>{p.script.length} 字符</span>
                </div>
              </section>
            )}
            {page === 2 && (
              <section>
                <div className="section-title">
                  <h3>场次解析 · 可人工修正</h3>
                  <div>
                    <button
                      onClick={() =>
                        update({
                          scenes: [
                            ...p.scenes,
                            {
                              id: uid(),
                              episode: "1",
                              name: "新场次",
                              interior: "内景",
                              time: "日",
                              characters: [],
                              text: "",
                              events: "",
                              emotion: "",
                              props: "",
                            },
                          ],
                        })
                      }
                    >
                      新增场次
                    </button>
                    <button
                      className="primary"
                      onClick={() => {
                        generate();
                        setPage(6);
                      }}
                    >
                      生成规则分镜
                    </button>
                  </div>
                </div>
                <p className="hint">
                  场次、对白人物和常见道具来自文本规则；情绪、事件含义和未标注人物需要人工确认。
                </p>
                {p.scenes.map((s, i) => (
                  <div className="scene-card" key={s.id}>
                    <div className="section-title">
                      <h3>SCENE {String(i + 1).padStart(2, "0")}</h3>
                      <button
                        onClick={() => {
                          if (
                            confirm(
                              "删除场次？关联镜头不会自动删除，请重新关联。",
                            )
                          )
                            update({
                              scenes: p.scenes.filter((x) => x.id !== s.id),
                            });
                        }}
                      >
                        删除场次
                      </button>
                    </div>
                    <div className="form-grid">
                      {Object.entries({
                        episode: "集数",
                        name: "场景名称",
                        interior: "内外景",
                        time: "日夜",
                        characters: "出场人物（顿号分隔）",
                        emotion: "情绪变化",
                        props: "关键道具",
                        events: "剧情事件",
                        text: "场次文本 / 动作与对白",
                      }).map(([key, label]) => (
                        <Field
                          key={key}
                          label={label}
                          value={
                            key === "characters"
                              ? s.characters.join("、")
                              : (s[key as keyof typeof s] as string)
                          }
                          onChange={(value) =>
                            update({
                              scenes: p.scenes.map((x) =>
                                x.id === s.id
                                  ? {
                                      ...x,
                                      [key]:
                                        key === "characters"
                                          ? value
                                              .split(/[、，,]/)
                                              .filter(Boolean)
                                          : value,
                                    }
                                  : x,
                              ),
                            })
                          }
                        />
                      ))}
                    </div>
                  </div>
                ))}
                {!p.scenes.length && (
                  <p className="empty">先导入并解析剧本，或新增场次。</p>
                )}
              </section>
            )}
            {page >= 3 && page <= 5 && (
              <section>
                <div className="section-title">
                  <h3>
                    {nav[page]} <span className="count">{p[kind].length}</span>
                  </h3>
                  <button
                    className="primary"
                    onClick={() => {
                      const a = { id: uid(), name: "新资产" };
                      update({ [kind]: [...p[kind], a] });
                      setSelectedAsset(a.id);
                    }}
                  >
                    <Plus size={15} />
                    新增资产
                  </button>
                </div>
                <p className="hint">
                  镜头引用统一资产资料，提示词实时读取固定描述。删除资产会保留镜头引用并给出缺失提醒。
                </p>
                <div className="asset-grid">
                  {p[kind].map((a) => (
                    <article
                      key={a.id}
                      onClick={() => setSelectedAsset(a.id)}
                      className={selectedAsset === a.id ? "selected" : ""}
                    >
                      <div className="asset-art">
                        <span>{a.name.slice(0, 1)}</span>
                        <span className="asset-type">
                          {page === 3
                            ? "CHARACTER"
                            : page === 4
                              ? "LOCATION"
                              : "PROP"}
                        </span>
                      </div>
                      <h3>{a.name}</h3>
                      <p>
                        {a.prompt ||
                          a.face ||
                          a.layout ||
                          a.appearance ||
                          "点击完善资产描述"}
                      </p>
                      <button onClick={() => setSelectedAsset(a.id)}>
                        编辑资料 <ChevronRight size={14} />
                      </button>
                    </article>
                  ))}
                </div>
              </section>
            )}
            {(page === 6 || page === 7) && (
              <section>
                <div className="section-title">
                  <h3>
                    {page === 6 ? "分镜制作表" : "连续时间轴"}{" "}
                    <span className="count">{p.shots.length} SHOTS</span>
                  </h3>
                  <div>
                    <button
                      onClick={() => {
                        const s = newShot(p.scenes[0]?.id);
                        update({ shots: [...p.shots, s] });
                        setSelected(s.id);
                      }}
                    >
                      <Plus size={15} />
                      增加镜头
                    </button>
                    <button onClick={generate}>规则生成初稿</button>
                  </div>
                </div>
                <p className="hint">
                  选中镜头后在右侧精修所有字段。确认镜头仅保护重新生成；人工编辑仍可进行。
                </p>
                {page === 7 && (
                  <>
                    <div className="timeline-strip">
                      {timeline(p.shots).map(({ shot: s, start, end }, i) => (
                        <button
                          key={s.id}
                          onClick={() => setSelected(s.id)}
                          style={{ flexGrow: s.duration }}
                          className={selected === s.id ? "selected" : ""}
                        >
                          <span>{String(i + 1).padStart(2, "0")}</span>
                          <small>
                            {start.toFixed(1)}—{end.toFixed(1)}s
                          </small>
                        </button>
                      ))}
                    </div>
                    <div className="form-grid">
                      <Field
                        label="目标片段时长（规划参数）"
                        number
                        value={p.settings.target}
                        onChange={(v) => {
                          if (+v > 0 && +v <= 3600)
                            update({ settings: { ...p.settings, target: +v } });
                        }}
                      />
                      <div>
                        <span className="hint">时长预设</span>
                        <div className="button-row">
                          {[5, 10, 15, 30].map((v) => (
                            <button
                              key={v}
                              onClick={() =>
                                update({
                                  settings: { ...p.settings, target: v },
                                })
                              }
                            >
                              {v}秒
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <p>
                      当前总时长 {total.toFixed(1)} 秒 · 与目标相差{" "}
                      {(total - p.settings.target).toFixed(1)}{" "}
                      秒。起止时间按镜头顺序自动连续计算。
                    </p>
                  </>
                )}
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>镜号 / 操作</th>
                        {page === 7 ? (
                          <>
                            <th>起始秒</th>
                            <th>结束秒</th>
                            <th>时长</th>
                            <th>画面</th>
                          </>
                        ) : (
                          Object.values(shotColumns).map((n) => (
                            <th key={n}>{n}</th>
                          ))
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {timeline(p.shots).map(({ shot: s, start, end }, i) => (
                        <tr
                          key={s.id}
                          className={selected === s.id ? "selected" : ""}
                          onClick={() => setSelected(s.id)}
                        >
                          <td>
                            <strong>
                              {String(i + 1).padStart(2, "0")}{" "}
                              {s.confirmed && <Check size={12} />}
                            </strong>
                            <div className="mini-actions">
                              <button
                                aria-label={`上移镜头${i + 1}`}
                                disabled={i === 0}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  move(s.id, -1);
                                }}
                              >
                                <ArrowUp size={12} />
                              </button>
                              <button
                                aria-label={`下移镜头${i + 1}`}
                                disabled={i === p.shots.length - 1}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  move(s.id, 1);
                                }}
                              >
                                <ArrowDown size={12} />
                              </button>
                              <button
                                aria-label={`复制镜头${i + 1}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const list = [...p.shots];
                                  list.splice(i + 1, 0, {
                                    ...s,
                                    id: uid(),
                                    confirmed: false,
                                  });
                                  update({ shots: list });
                                }}
                              >
                                <Copy size={12} />
                              </button>
                              <button
                                aria-label={`删除镜头${i + 1}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeShot(s.id);
                                }}
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </td>
                          {page === 7 ? (
                            <>
                              <td>{start.toFixed(1)}</td>
                              <td>{end.toFixed(1)}</td>
                              <td>{s.duration}s</td>
                              <td>{s.picture}</td>
                            </>
                          ) : (
                            Object.keys(shotColumns).map((k) => (
                              <td key={k}>
                                {k === "sceneId"
                                  ? p.scenes.find((a) => a.id === s.sceneId)
                                      ?.name || "未关联"
                                  : k === "locationId"
                                    ? p.locations.find(
                                        (a) => a.id === s.locationId,
                                      )?.name || "未关联"
                                    : k === "characters"
                                      ? s.characters
                                          .map(
                                            (id) =>
                                              p.characters.find(
                                                (a) => a.id === id,
                                              )?.name || "缺失",
                                          )
                                          .join("、")
                                      : k === "propIds"
                                        ? s.propIds
                                            .map(
                                              (id) =>
                                                p.props.find((a) => a.id === id)
                                                  ?.name || "缺失",
                                            )
                                            .join("、")
                                        : String(s[k as keyof Shot])}
                              </td>
                            ))
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!p.shots.length && (
                  <p className="empty">解析剧本后生成初稿，或手动新增镜头。</p>
                )}
              </section>
            )}
            {page === 8 && (
              <section>
                <div className="section-title">
                  <h3>视频提示词编排</h3>
                  <span className="tag amber">模板处理 · 未接入模型 API</span>
                </div>
                <div className="form-grid">
                  <label className="field">
                    <span>视频模型模板</span>
                    <select
                      aria-label="视频模型模板"
                      value={p.settings.model}
                      onChange={(e) => {
                        update({
                          settings: {
                            ...p.settings,
                            model: e.target.value as "seedance" | "wan",
                          },
                        });
                        setPromptEdited(false);
                      }}
                    >
                      <option value="seedance">Seedance 2.5</option>
                      <option value="wan">Wan 3.0（万相）</option>
                    </select>
                  </label>
                  <Field
                    label="画幅比例"
                    value={p.settings.ratio}
                    options={["16:9", "9:16"]}
                    onChange={(ratio) =>
                      update({ settings: { ...p.settings, ratio } })
                    }
                  />
                  <Field
                    label="风格"
                    value={p.settings.style}
                    options={[
                      "3D动漫",
                      "电影级CG写实",
                      "UE5/PBR质感",
                      "现代都市写实",
                      "玄幻仙侠",
                      "传统二维动漫",
                    ]}
                    onChange={(style) =>
                      update({ settings: { ...p.settings, style } })
                    }
                  />
                  <Field
                    label="画质目标"
                    value={p.settings.quality}
                    options={["1080P", "4K", "8K"]}
                    onChange={(quality) =>
                      update({ settings: { ...p.settings, quality } })
                    }
                  />
                  <Field
                    label="目标片段时长"
                    number
                    value={p.settings.target}
                    onChange={(v) => {
                      if (+v > 0 && +v <= 3600)
                        update({ settings: { ...p.settings, target: +v } });
                    }}
                  />
                  <Field
                    label="拆分片段上限（自行核实模型能力）"
                    number
                    value={p.settings.segment}
                    onChange={(v) => {
                      if (+v > 0 && +v <= 3600)
                        update({ settings: { ...p.settings, segment: +v } });
                    }}
                  />
                </div>
                <p className="hint amber-text">
                  以上模型名称仅作为可编辑模板标签。具体版本、接口、长度与分辨率尚未核实，不代表可以生成视频。30秒时间轴可用于制作规划。
                </p>
                <div className="section-title">
                  <h3>
                    镜头选择 <small>按原始顺序合并 · 不选则使用全部</small>
                  </h3>
                  <button
                    onClick={() =>
                      setChosen(chosen.length ? [] : p.shots.map((s) => s.id))
                    }
                  >
                    {chosen.length ? "清空选择" : "全选"}
                  </button>
                </div>
                <div className="form-grid">
                  <Field
                    label="片段开始镜号"
                    number
                    value={rangeStart}
                    onChange={(v) => setRangeStart(Math.max(1, Math.floor(+v)))}
                  />
                  <Field
                    label="片段结束镜号"
                    number
                    value={rangeEnd}
                    onChange={(v) => setRangeEnd(Math.max(1, Math.floor(+v)))}
                  />
                </div>
                <button
                  onClick={() => {
                    if (
                      rangeStart > rangeEnd ||
                      rangeEnd > p.shots.length ||
                      !Number.isFinite(rangeStart) ||
                      !Number.isFinite(rangeEnd)
                    ) {
                      setMessage(
                        "片段范围无效：开始镜号不得大于结束镜号，且必须在已有镜头范围内。",
                      );
                      return;
                    }
                    setChosen(
                      p.shots.slice(rangeStart - 1, rangeEnd).map((s) => s.id),
                    );
                    setPromptEdited(false);
                    const times = timeline(p.shots);
                    setMessage(
                      `已选择原时间轴 ${times[rangeStart - 1].start.toFixed(1)}—${times[rangeEnd - 1].end.toFixed(1)} 秒；导出片段从 0 秒起连续编排。`,
                    );
                  }}
                >
                  选择连续片段
                </button>
                <p className="hint">
                  当前选择 {working.length} 镜头，共{" "}
                  {working.reduce((sum, s) => sum + s.duration, 0).toFixed(1)}{" "}
                  秒。可按镜号指定片段起止，或勾选镜头。
                </p>
                <div className="shot-picker">
                  {p.shots.map((s, i) => (
                    <label key={s.id}>
                      <input
                        type="checkbox"
                        checked={chosen.includes(s.id)}
                        onChange={() => {
                          toggle(s.id);
                          setPromptEdited(false);
                        }}
                      />{" "}
                      {String(i + 1).padStart(2, "0")} · {s.duration}s
                    </label>
                  ))}
                </div>
                <div className="button-row">
                  <button
                    className="primary"
                    onClick={() => {
                      setPromptEdited(false);
                      update({ prompt: generated });
                      setMessage("已按当前模板与镜头顺序生成。");
                    }}
                  >
                    重新生成提示词
                  </button>
                  <button onClick={copy}>
                    <Copy size={14} />
                    复制
                  </button>
                  <button
                    onClick={() =>
                      download(
                        `${p.name}-提示词.txt`,
                        output,
                        "text/plain;charset=utf-8",
                      )
                    }
                  >
                    导出 TXT
                  </button>
                  <button
                    onClick={() => {
                      const groups = splitSegments(working, p.settings.segment);
                      update({
                        prompt: groups
                          .map(
                            (g, i) =>
                              `=== 规划片段 ${i + 1} ===\n${prompt(p, g)}`,
                          )
                          .join("\n\n"),
                      });
                      setPromptEdited(true);
                      setMessage(
                        "已按完整镜头拆分；超出上限的单镜头需手动拆开，未宣称模型支持这些时长。",
                      );
                    }}
                  >
                    拆分为多个片段
                  </button>
                </div>
                <textarea
                  className="prompt-editor"
                  aria-label="生成的提示词"
                  value={output}
                  onChange={(e) => {
                    update({ prompt: e.target.value });
                    setPromptEdited(true);
                  }}
                />
                <details>
                  <summary>编辑当前模型的独立模板</summary>
                  <p className="hint">
                    保留占位符{" "}
                    {"{duration} {ratio} {style} {quality} {assets} {timeline}"}
                    。清空恢复内置模板。
                  </p>
                  <textarea
                    className="template-editor"
                    value={
                      p.templates[p.settings.model] ||
                      (p.settings.model === "seedance"
                        ? seedanceTemplate
                        : wanTemplate)
                    }
                    onChange={(e) =>
                      update({
                        templates: {
                          ...p.templates,
                          [p.settings.model]: e.target.value,
                        },
                      })
                    }
                  />
                  <button
                    onClick={() =>
                      update({
                        templates: { ...p.templates, [p.settings.model]: "" },
                      })
                    }
                  >
                    恢复默认模板
                  </button>
                </details>
                <details open>
                  <summary>连贯性规则提醒（不含 AI 视觉验证）</summary>
                  <ul className="warnings">
                    {continuity(p, working).map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </details>
              </section>
            )}
            {page === 9 && (
              <section>
                <h3>制作文件交付</h3>
                <p className="hint">
                  CSV 使用 UTF-8 BOM 与标准引号转义；JSON
                  保存完整项目和当前提示词，可重新导入恢复。
                </p>
                <div className="export-grid">
                  {[
                    [
                      "CSV",
                      "完整分镜表格",
                      "导出 CSV",
                      () =>
                        download(
                          `${p.name}-分镜.csv`,
                          csv(p),
                          "text/csv;charset=utf-8",
                        ),
                    ],
                    [
                      "TXT",
                      "当前模型提示词",
                      "导出 TXT",
                      () =>
                        download(
                          `${p.name}-提示词.txt`,
                          output,
                          "text/plain;charset=utf-8",
                        ),
                    ],
                    [
                      "JSON",
                      "完整项目可恢复备份",
                      "备份项目",
                      () =>
                        download(
                          `${p.name}.json`,
                          JSON.stringify({ ...p, prompt: output }, null, 2),
                          "application/json",
                        ),
                    ],
                  ].map(([type, desc, label, action]) => (
                    <article key={String(type)}>
                      <span className="export-type">{String(type)}</span>
                      <h3>{String(desc)}</h3>
                      <button
                        className="primary"
                        onClick={action as () => void}
                      >
                        <Download size={15} />
                        {String(label)}
                      </button>
                    </article>
                  ))}
                </div>
                <button onClick={() => fileRef.current?.click()}>
                  <FolderOpen size={15} />从 JSON 恢复项目
                </button>
                <p className="hint">
                  DOCX / PDF / XLSX 导出尚未实现。建议在清理浏览器数据前备份
                  JSON。
                </p>
              </section>
            )}
            {page === 10 && (
              <section>
                <h3>系统设置与能力状态</h3>
                <Field
                  label="项目名称"
                  value={p.name}
                  onChange={(name) => update({ name })}
                />
                <div className="capability">
                  <h3>已实现</h3>
                  <p>
                    本地项目管理、TXT
                    导入、规则解析、资产编辑、分镜编辑、连续时间轴、模型独立模板、连贯性规则提醒、CSV/TXT/JSON
                    导出与恢复。
                  </p>
                  <h3>规则处理范围</h3>
                  <p>
                    场次标题、出场人物、对白、常见道具匹配；逐行拆镜及摄影参数默认值。未标注的人物、复杂动作与情绪须人工精修。
                  </p>
                  <h3>未接入 / 待扩展</h3>
                  <p>
                    真实 AI 推理、视频生成、模型 API、视觉一致性验证、DOCX/PDF
                    导入。没有 API Key，也不会发送剧本到服务器。后续 API
                    应通过服务端代理接入，避免在浏览器存储密钥。
                  </p>
                  <h3>数据存储</h3>
                  <p>
                    浏览器 localStorage 自动保存，无云端同步。失败时会提示；JSON
                    是可迁移备份。示例人物描述是演示资产，不是 AI 生成。
                  </p>
                </div>
              </section>
            )}
          </main>
          <aside className="inspector">
            <div className="section-title">
              <h3>属性检查器</h3>
              <span className="tag">EDIT</span>
            </div>
            {page >= 3 && page <= 5 && asset ? (
              <>
                <span className="eyebrow">ASSET / {asset.name}</span>
                {Object.entries(fields[kind]).map(([key, label]) => (
                  <Field
                    key={key}
                    label={label}
                    value={asset[key] || ""}
                    onChange={(v) =>
                      update({
                        [kind]: p[kind].map((a) =>
                          a.id === asset.id ? { ...a, [key]: v } : a,
                        ),
                      })
                    }
                  />
                ))}
                <button
                  className="danger"
                  onClick={() => {
                    if (confirm("删除资产？已关联镜头将标记缺失。")) {
                      update({
                        [kind]: p[kind].filter((a) => a.id !== asset.id),
                      });
                      setSelectedAsset("");
                    }
                  }}
                >
                  <Trash2 size={14} />
                  删除资产
                </button>
              </>
            ) : shot && (page === 6 || page === 7) ? (
              <>
                <span className="eyebrow">
                  SHOT {String(p.shots.indexOf(shot) + 1).padStart(2, "0")}
                </span>
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={shot.confirmed}
                    onChange={(e) =>
                      changeShot({ confirmed: e.target.checked })
                    }
                  />
                  确认内容 · 重新生成时保留
                </label>
                <label className="field">
                  <span>所属场次</span>
                  <select
                    aria-label="所属场次"
                    value={shot.sceneId}
                    onChange={(e) => changeShot({ sceneId: e.target.value })}
                  >
                    <option value="">未关联</option>
                    {p.scenes.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>场景资产</span>
                  <select
                    aria-label="场景资产"
                    value={shot.locationId}
                    onChange={(e) => changeShot({ locationId: e.target.value })}
                  >
                    <option value="">未关联</option>
                    {p.locations.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </label>
                {(["characters", "props"] as const).map((k) => (
                  <div className="field" key={k}>
                    <span>{k === "characters" ? "出场角色" : "关联道具"}</span>
                    {p[k].map((a) => (
                      <label className="checkbox" key={a.id}>
                        <input
                          type="checkbox"
                          checked={(k === "characters"
                            ? shot.characters
                            : shot.propIds
                          ).includes(a.id)}
                          onChange={(e) => {
                            const key =
                              k === "characters" ? "characters" : "propIds";
                            changeShot({
                              [key]: e.target.checked
                                ? [...shot[key], a.id]
                                : shot[key].filter((id) => id !== a.id),
                            });
                          }}
                        />
                        {a.name}
                      </label>
                    ))}
                  </div>
                ))}
                {Object.entries(shotColumns)
                  .filter(
                    ([k]) =>
                      ![
                        "sceneId",
                        "locationId",
                        "characters",
                        "propIds",
                      ].includes(k),
                  )
                  .map(([key, label]) => (
                    <Field
                      key={key}
                      label={label}
                      number={key === "duration"}
                      options={
                        key === "size"
                          ? sizes
                          : key === "position"
                            ? positions
                            : key === "movement"
                              ? movements
                              : undefined
                      }
                      value={shot[key as keyof Shot] as string | number}
                      onChange={(v) => {
                        if (key === "duration") {
                          if (+v > 0 && +v <= 3600)
                            changeShot({ duration: +v });
                        } else changeShot({ [key]: v });
                      }}
                    />
                  ))}
              </>
            ) : (
              <>
                <div className="inspector-placeholder">
                  <Film size={32} />
                  <h3>每个细节，都可掌控</h3>
                  <p>
                    选择角色、场景、道具或分镜，
                    <br />
                    在这里编辑完整制作属性。
                  </p>
                </div>
                <div className="summary-row">
                  <span>项目</span>
                  <strong>{p.name}</strong>
                </div>
                <div className="summary-row">
                  <span>规划时长</span>
                  <strong>{total.toFixed(1)} 秒</strong>
                </div>
                <div className="summary-row">
                  <span>画幅</span>
                  <strong>{p.settings.ratio}</strong>
                </div>
                <div className="summary-row">
                  <span>生成模式</span>
                  <strong>规则 / 模板</strong>
                </div>
                <p className="hint">
                  自动保存仅限当前浏览器。尚未连接任何视频生成 API。
                </p>
              </>
            )}
          </aside>
        </div>
        <footer>
          <span>
            <span className="dot" /> LOCAL WORKSPACE
          </span>
          <span>
            {p.shots.length} 镜头 · {total.toFixed(1)} 秒 · {p.settings.ratio}
          </span>
          <span>AI DRAMA STUDIO / V1.0</span>
        </footer>
      </div>
      <input
        hidden
        ref={fileRef}
        type="file"
        accept=".json,application/json"
        onChange={(e) => void importJSON(e.target.files?.[0])}
      />
      <input
        hidden
        ref={txtRef}
        type="file"
        accept=".txt,text/plain"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (f) {
            try {
              update({ script: await f.text() });
              setMessage("TXT 已导入，原始文本保留。");
            } catch {
              setMessage("TXT 读取失败，请检查文件。");
            }
          }
          if (txtRef.current) txtRef.current.value = "";
        }}
      />
    </div>
  );
}
