import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
test("多场次示例完整制作闭环与项目持久化", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("dialog", (d) => d.accept());
  await page.goto("/");
  const nav = (name: string) =>
    page.locator("nav").getByRole("button", { name });
  await expect(
    page.getByRole("heading", { name: "让故事，进入制作。" }),
  ).toBeVisible();
  await nav("剧本管理").click();
  await expect(page.getByRole("textbox", { name: "原始剧本" })).toContainText(
    "场次2",
  );
  await page.getByRole("button", { name: "规则解析剧本", exact: true }).click();
  await expect(page.getByRole("heading", { name: "SCENE 01" })).toBeVisible();
  await page.getByRole("button", { name: "生成规则分镜", exact: true }).click();
  await expect(page.locator("tbody tr")).toHaveCount(12);
  await page.locator("tbody tr").first().click();
  await page.getByLabel("镜头时长", { exact: true }).fill("2.5");
  await page.getByLabel("人物站位", { exact: true }).fill("桌子左侧");
  await page.getByLabel("画面描述", { exact: true }).fill("测试精修画面");
  await page.getByLabel("确认内容 · 重新生成时保留").check();
  await page.getByRole("button", { name: "复制镜头1", exact: true }).click();
  await expect(page.locator("tbody tr")).toHaveCount(13);
  await page.getByRole("button", { name: "下移镜头1", exact: true }).click();
  await page.getByRole("button", { name: "删除镜头1", exact: true }).click();
  await expect(page.locator("tbody tr")).toHaveCount(12);
  await nav("时间轴编辑").click();
  await expect(
    page.locator("tbody tr").first().locator("td").nth(2),
  ).toHaveText("2.5");
  await nav("角色资产库").click();
  await page.getByRole("heading", { name: "林舟", exact: true }).click();
  await page.getByLabel("发型与发色", { exact: true }).fill("银色短发");
  await page.getByRole("button", { name: "新增资产", exact: true }).click();
  await page.getByLabel("角色名称", { exact: true }).fill("配角测试");
  await expect(
    page.getByRole("heading", { name: "配角测试", exact: true }),
  ).toBeVisible();
  await nav("场景资产库").click();
  await page.locator(".asset-grid article").first().click();
  await page.getByLabel("空间结构 / 门窗与家具位置").fill("门在左侧，窗在右侧");
  await nav("道具资产库").click();
  await page.locator(".asset-grid article").first().click();
  await page.getByLabel("材质", { exact: true }).fill("牛皮纸");
  await nav("视频提示词生成").click();
  await page.getByLabel("片段开始镜号", { exact: true }).fill("1");
  await page.getByLabel("片段结束镜号", { exact: true }).fill("2");
  await page.getByRole("button", { name: "选择连续片段", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("0.0—5.5 秒");
  await page.getByRole("button", { name: "清空选择", exact: true }).click();
  await page.getByLabel("画幅比例", { exact: true }).selectOption("9:16");
  const out = page.getByRole("textbox", { name: "生成的提示词" });
  await expect(out).toContainText("银色短发");
  await expect(out).toContainText("9:16");
  await expect(out).toContainText("我必须知道真相");
  await page.getByLabel("视频模型模板").selectOption("wan");
  await expect(out).toContainText("主体与世界");
  await page
    .getByRole("button", { name: "拆分为多个片段", exact: true })
    .click();
  await expect(out).toContainText("规划片段 2");
  await out.fill("人工最终提示词，必须持久化");
  await page.reload();
  await nav("视频提示词生成").click();
  await expect(out).toHaveValue("人工最终提示词，必须持久化");
  await nav("文件导出").click();
  const exportFile = async (name: string) => {
    const pending = page.waitForEvent("download");
    await page.getByRole("button", { name, exact: true }).click();
    const d = await pending;
    return readFile((await d.path())!, "utf8");
  };
  const csv = await exportFile("导出 CSV");
  expect(csv).toContain("测试精修画面");
  expect(csv.charCodeAt(0)).toBe(0xfeff);
  const txt = await exportFile("导出 TXT");
  expect(txt).toBe("人工最终提示词，必须持久化");
  const json = await exportFile("备份项目");
  const data = JSON.parse(json);
  expect(data.shots).toHaveLength(12);
  expect(data.characters).toHaveLength(3);
  await page
    .locator("input[type=file]")
    .first()
    .setInputFiles({
      name: "backup.json",
      mimeType: "application/json",
      buffer: Buffer.from(json),
    });
  await expect(page.getByRole("status")).toContainText("已恢复");
  await expect(page.getByLabel("当前项目", { exact: true })).toContainText(
    "（恢复）",
  );
  await nav("智能分镜").click();
  await page.locator("tbody tr").first().click();
  await expect(page.getByLabel("画面描述", { exact: true })).toHaveValue(
    "测试精修画面",
  );
  await page
    .locator("input[type=file]")
    .first()
    .setInputFiles({
      name: "bad.json",
      mimeType: "application/json",
      buffer: Buffer.from('{"version":2}'),
    });
  await expect(page.getByRole("status")).toContainText("导入失败");
  await expect(page.locator("tbody tr")).toHaveCount(12);
  await page.getByRole("button", { name: "新建", exact: true }).click();
  await page
    .getByRole("textbox", { name: "原始剧本" })
    .fill("场次1 内景 房间 日\n甲：你好\n乙：再见");
  await page.getByRole("button", { name: "保存草稿", exact: true }).click();
  await page.reload();
  await nav("剧本管理").click();
  // Project choice is not persisted, but all project content must be.
  await page
    .getByLabel("当前项目", { exact: true })
    .selectOption({ label: "新项目" });
  await expect(page.getByRole("textbox", { name: "原始剧本" })).toHaveValue(
    "场次1 内景 房间 日\n甲：你好\n乙：再见",
  );
  expect(errors).toEqual([]);
});
test("TXT 导入与存储失败中文提示", async ({ page }) => {
  await page.goto("/");
  await page.locator("nav").getByRole("button", { name: "剧本管理" }).click();
  await page
    .locator("input[type=file]")
    .nth(1)
    .setInputFiles({
      name: "script.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("场次1 外景 山路 夜\n甲：走吧。"),
    });
  await expect(page.getByRole("textbox", { name: "原始剧本" })).toHaveValue(
    "场次1 外景 山路 夜\n甲：走吧。",
  );
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("quota", "QuotaExceededError");
    };
  });
  await page.getByRole("button", { name: "保存草稿" }).click();
  await expect(page.getByRole("status")).toContainText("保存失败");
});

test("三类资产新增关联、确认保护与删除提醒", async ({ page }) => {
  page.on("dialog", (d) => d.accept());
  await page.goto("/");
  const nav = (name: string) =>
    page.locator("nav").getByRole("button", { name });
  for (const [pageName, field, name] of [
    ["角色资产库", "角色名称", "替身"],
    ["场景资产库", "场景名称", "测试房间"],
    ["道具资产库", "道具名称", "测试钥匙"],
  ]) {
    await nav(pageName).click();
    await page.getByRole("button", { name: "新增资产", exact: true }).click();
    await page.getByLabel(field, { exact: true }).fill(name);
    await page.getByRole("button", { name: "保存项目", exact: true }).click();
  }
  await nav("智能分镜").click();
  await page.locator("tbody tr").first().click();
  await page
    .getByLabel("场景资产", { exact: true })
    .selectOption({ label: "测试房间" });
  await page.getByLabel("替身", { exact: true }).check();
  await page.getByLabel("测试钥匙", { exact: true }).check();
  await page.getByLabel("画面描述", { exact: true }).fill("不可覆盖的确认镜头");
  await page.getByLabel("确认内容 · 重新生成时保留").check();
  await page.getByRole("button", { name: "规则生成初稿", exact: true }).click();
  await expect(page.locator("tbody tr")).toHaveCount(13);
  await page.locator("tbody tr").first().click();
  await expect(page.getByLabel("画面描述", { exact: true })).toHaveValue(
    "不可覆盖的确认镜头",
  );
  await expect(page.getByLabel("测试钥匙", { exact: true })).toBeChecked();
  await nav("道具资产库").click();
  await page.getByRole("heading", { name: "测试钥匙", exact: true }).click();
  await page.getByRole("button", { name: "删除资产", exact: true }).click();
  await nav("视频提示词生成").click();
  await expect(page.locator(".warnings")).toContainText("已删除资产");
  await nav("项目工作台").click();
  await page.getByLabel("当前项目名称", { exact: true }).fill("更名测试");
  await expect(page.getByLabel("当前项目", { exact: true })).toContainText(
    "更名测试",
  );
  await page
    .locator(".project-grid")
    .getByRole("button", { name: "删除", exact: true })
    .click();
  await expect(page.getByLabel("当前项目", { exact: true })).not.toContainText(
    "更名测试",
  );
});

test("损坏本地数据不会静默覆盖", async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("ai-drama-studio-v1", "broken json"),
  );
  await page.goto("/");
  await expect(page.getByRole("status")).toContainText("原存储尚未覆盖");
  expect(
    await page.evaluate(() => localStorage.getItem("ai-drama-studio-v1")),
  ).toBe("broken json");
});
