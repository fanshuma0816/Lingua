# 额度与权益提示验收

本次只改提示和展示状态，不改额度发放、预留、确认、释放、课程权限或支付逻辑，也不新增 SQL。
状态行使用服务器的 available，reserved 单独显示。剩余数与预留数不会相加后冒充可用次数。
余额读取失败、加载中或数据缺失／不一致时不显示数字，不把未知当作 0。
功能关闭时隐藏新提示。当前阶段不推断订阅状态；显式 Pro 响应不显示免费账户计数。

## 入口和文案

- App 的主内容顶部统一显示身份、可生成次数和可展开的权益说明，沿用现有页面结构。
- 权益说明明确次数指新课程生成，不是学习、步骤或音频播放次数。
- 游客 1 次，账户额外一次性 3 次，不按月刷新，重新登录不重置，注册不自动收费。
- 推荐和查看材料不扣课次。真正出课按钮附近说明成功交付到 Quick Scan 后才用 1 次。
- 已生成课程明确继续／复习不再扣次。历史入口显示免费复习，材料入口区分恢复原课和生成下一课。
- 游客被提醒登录保留课程，避免把匿名设备记录误解为可永久跨设备访问。

## 自动检查

`npm run test:generation` 包含额度状态展示测试及现有数据库、接口和客户端检查。
本机预览可用 `PHASE1_PREVIEW_URL=http://localhost:3000 npm run test:generation:browser` 检查。
浏览器脚本使用模拟接口，不连接正式 Supabase。需要保存截图可设置 PHASE1_SCREENSHOT_DIR 为已有的本地目录。

## 真实测试部署检查（待执行）

| 场景 | 预期 |
|---|---|
| 游客首访／首次完成课程 | 游客可生成 1 次，确认成功后变为 0 |
| 免费账户，3 次已用 1 次 | 免费账户可生成 2 次 |
| 上述账户另有 1 次处理中 | 显示可生成 1 次，另有 1 次处理中；详细统计为 3／1／1／1 |
| 最后 1 次／额度用完 | 提示不同，旧课免费复习入口始终可用 |
| 查询额度断网或服务失败 | 显示暂时无法读取，不显示旧数字或 0；可重新查询 |
| 重新查询尚未返回 | 显示查询中，不显示错误的可用次数 |
| 旧课、Quick Scan、预览、学习、完成页 | 都能看到统一状态；已交付课程显示继续学习免费 |
| 收藏材料 | 原课程免费复习，未生成部分说明生成计次 |
| 中英文／390px 手机／暗色模式 | 含义一致，无横向溢出，不遮挡原操作 |
| 多标签页扣次 | 其他标签从后台刷新提示，不重复扣次 |
| MONETIZATION_MODE=off | 不显示虚构余额、免费账户标志或计次说明 |

真实部署仍需先完成第一阶段 SQL 和环境配置；本次不自动执行或修改这些内容。


## Compact quota and login feedback

- Rules are collapsed by default and contain only three short explanations.
- Initial failure shows no fabricated zero and no lesson recovery claim.
- Background refresh keeps the last validated balance with an updating/stale label.
- With a 503 quota response, sidebar and Progress login still open; sending an email does not require a successful quota read.
- Pending request status checks use GET for the original request, never a new generation POST.
- Navigation clears operation feedback without deleting saved lessons or pending requests.
- Verify English desktop, Chinese mobile, dark mode, and keyboard access.
- Real Preview database connectivity and email callback remain separate manual checks; local API mocks do not validate those services.
