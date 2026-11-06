# 第一阶段：同一个 Supabase 项目的执行与验收指南

## 当前边界

只实施游客 1 次、账户额外一次性 3 次、服务端请求幂等、Quick Scan 确认扣次及旧课恢复。
没有支付、订阅或 Pro 开通逻辑。`pro: false` 是第一阶段返回值，不代表已实现收费。
首页结构、全局样式、课程步骤、教学算法和官网文件未修改；App 预告 banner 的挂载已移除。
功能默认 `MONETIZATION_MODE=off`，执行建表 SQL 本身不启用限制，也不批量发正式额度。

## 1. 在现有正式 Supabase 中执行建表 SQL

1. 打开现有项目，进入 SQL Editor，创建一个 New query。
2. 在本地打开 `supabase/migrations/20261106_generation_entitlements.sql`。
3. 复制文件的**全部内容**，从 `begin;` 前的注释到最后 `commit;`，粘贴进 SQL Editor。
4. 点击 Run。成功结果通常为 Success. No rows returned。
5. 如果报错，保留错误原文；不要删除旧表，也不要关闭 RLS。事务内失败不会部分应用本次建表操作。
6. 新建另一个查询，执行同目录说明下面的验证文件 `docs/testing/PHASE1_VERIFY.sql`。

本次新增 6 张表：generation_subjects、generation_grants、generation_requests、generated_lessons、generation_usage、generation_rate_limits。
不会修改原有 lesson_sessions、profiles、user_materials 等表、策略或数据。
新表与 RPC 仅允许服务端 service_role 操作，浏览器不能直接改额度。
SQL 可重复执行；已有额度和使用记录不会重置。

## 2. 设置测试部署，继续连接同一 Supabase

正式网站保持 `MONETIZATION_MODE=off`。测试部署使用同一个 Supabase URL，但单独设置：

```dotenv
MONETIZATION_MODE=test
MONETIZATION_TEST_USER_IDS=专用测试账户的用户UUID
GUEST_SIGNING_SECRET=你自行生成并保存的至少32字符随机值
APP_ORIGIN=https://你的固定测试域名
```

- `APP_ORIGIN` 是测试站自己的完整域名，不是 Supabase URL，不加末尾斜杠；本地使用实际访问的 `http://localhost:3000` 等地址。
- Supabase 的三项现有配置见 `.env.example`，沿用同一个项目。service_role 密钥只能放服务端配置，不要发到聊天或提交到 Git。
- 测试账户使用单独邮箱注册。在 Supabase 的 Authentication → Users 中复制它的用户 ID，填入白名单；多个 ID 用逗号隔开。
- 不要把日常或真实用户账户放入测试白名单。新额度和课程有 test/production 隔离；原有收藏、材料及 Auth 仍共用项目，测试只能使用专用账户。
- 游客测试在测试部署的无痕窗口进行，不需要先登录。不能把测试配置部署到正式域名。
- 把测试站邮件回调地址加入 Supabase Auth 的 Redirect URLs 允许列表；保留现有正式回调，不更改正式 Site URL。测试和正式邮件发送仍共用项目。
- 登录信息保存在当前站点的本地存储中，不同域名不会自动共享登录。
- Guest secret 应长期稳定。变更它会使原游客 Cookie 失效。

测试数据区分由服务端配置决定，客户端传入 environment、userId 或剩余次数均不能改变实际权限。
数据库、登录配置和资源仍然共享，不能在该项目里重置数据库或对真实用户做测试。

## 3. 检查和设置预留回收

额度预留默认 15 分钟。每次额度相关操作都会回收当前身份的过期预留。
同时建议在 Supabase Integrations → Cron 创建一个任务：

- 名称：lingua-expire-generation-requests
- 时间表达式：`*/5 * * * *`
- 类型：SQL snippet
- 内容：`select public.lingua_expire_generation_requests();`

如果 Cron 尚未启用，按 Dashboard 提示启用 pg_cron；不需要删改已有任务。
这个函数仅回收过期未交付请求和过期频率统计，不删除课程、不重置已扣次数。
也可以用外部计划任务调用 POST `/api/lesson/maintenance`，需配置独立维护密钥；二选一即可。
参考：https://supabase.com/docs/guides/cron/quickstart

## 4. 手工验收顺序

1. 无痕打开测试站。首次生成完整课程，看到 Quick Scan 后额度变为已使用 1 次。
2. 刷新页面、重复打开 Quick Scan，不增加扣次，课程编号不变。
3. 再次生成，提示登录；输入材料保留。
4. 使用专用账户登录；游客已交付课程归入账户，账户另有 3 次可用额度。
5. 退出、再次登录，余额不回到 3。
6. 生成三节课；第 4 次被阻止，历史课程都能打开。
7. 在 Quick Scan 标记词、进入后续步骤后离开，再从进度页打开，恢复原课。
8. 从收藏材料打开已生成分段不扣次；未生成分段必须检查额度。
9. 以手机宽度和中英文各走一次。
10. 测试失败、连续点击、多标签页同时争用最后一次额度和断网恢复；在正式 Supabase 上只用少量专用测试请求。
11. 对比 test 和 production 的额度与课程：测试记录不应出现在正式环境。

Supabase 已付周期和 Stripe 场景不属于本阶段，不应标记为已验收。

## 5. 历史记录兼容与限制

课程的按步骤分析结果按课程编号和参数保存在服务端，复习可直接复用已生成内容。
新课程在确认扣次前就写入服务端，确认后即使没点完成页的保存，也可从进度页恢复。
自动保留恢复位置和标记词；练习正文与答案按完成页“包含练习”选项保存，未保存的练习草稿仍保留在当前设备。重复保存更新同一课程。
完整历史快照可免费导入固定课程记录；导入不扣额度，重复导入不重复建课。
部分旧版本只保存了原文、词汇与答案，缺少原测验等字段。这类记录仍可查看，但会提示无法完整恢复，不会偷偷重新生成或扣次。
仅存在浏览器、没有服务端可验证记录的旧课，不自动作为已获得权限的课程导入。
游客 Cookie 丢失后无法证明原匿名身份；建议登录后保留课程。匿名防重复不承诺识别所有清 Cookie 或换设备行为。

## 6. 本地自动检查

安装项目依赖后执行：

```sh
npm run test:generation
npm run build
```

测试使用 PGlite 的 PostgreSQL 引擎运行真实 SQL 和服务端接口，Supabase 请求由本地适配器处理，不连接正式项目。
该引擎将同一连接的操作串行执行，测试覆盖额度状态与重复操作；真实多连接行锁竞争仍需在测试部署用专用账户验收。

浏览器检查先启动本地应用，再运行：

```sh
npm run dev
PHASE1_PREVIEW_URL=http://localhost:3000 npm run test:generation:browser
```

浏览器脚本只接受 localhost 或 127.0.0.1，接口由测试脚本模拟，覆盖英文桌面和中文手机宽度的新课、扣次、刷新、免费复习。

## 7. 正式启用与回退

建表和代码检查完成不等于正式上线。先完成上述人工验收，再将正式部署的模式切换为 production，使用正式站 APP_ORIGIN 与稳定的游客签名密钥。
正式额度在账户首次访问新功能时幂等发放，覆盖新旧账户，不按月刷新。测试额度不会迁入正式额度。
此阶段没有收费；账户额度耗尽后只有提示和免费复习入口。
测试期间要关闭新功能，将测试部署模式恢复为 off；不要删表、清流水或重置正式账户额度。
启用正式新课程后如需回滚，应先保留课程读取能力；不能把关闭全部功能当作无损回滚，因为新课程存在 generated_lessons 中。
