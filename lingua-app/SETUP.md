# Lingua — 上线指南（给非技术用户）

这是产品的「真实版」项目。它和你之前的原型体验完全一样，但课程内容、翻译、词义例句、选择题、AI 对话、语音朗读都可以由真实的 Google AI 生成，而不是模拟的。

**核心原理：** 只要你填入下面的凭据，内容就变真的；不填，它照常运行，只是用内置的模拟内容。凭据永远只存在服务器端，不会暴露在浏览器里（这也是我们从单文件原型升级到 Next.js 的原因）。

**这个项目用到两套 Google Cloud 凭据（都在同一个 GCP 项目里）：**

- **服务账号 JSON**（`GOOGLE_APPLICATION_CREDENTIALS_JSON`）—— 文本生成走 **Google Cloud Vertex AI**（Gemini `gemini-2.0-flash-001` 模型），负责语法分析、课程内容、写作反馈、AI 对话。走 Vertex AI 会消耗你 GCP 项目的额度／免费试用赠金，而**不是** Google AI Studio 的预付费扣费。
- `GCP_API_KEY` —— 来自 Google Cloud，负责翻译（Cloud Translation API）和语音朗读（Cloud Text-to-Speech API）。这一个 API key 要在同一个项目里同时开通这两个 API。

---

## 第一步：拿到凭据

### 1）Vertex AI 服务账号 JSON（`GOOGLE_APPLICATION_CREDENTIALS_JSON`）
- 打开 https://console.cloud.google.com/ ，选中你的项目（如 `lingua-tts-504817`）。
- 在 "APIs & Services → Library" 里搜索并**启用** **Vertex AI API**。
- 到 "IAM & Admin → Service Accounts"，创建（或选一个已有的）服务账号，授予 **Vertex AI User**（或 Owner）角色。
- 进入该服务账号 → "Keys → Add Key → Create new key → JSON"，下载这份 JSON 文件，先存好。
  - 提示：这就是你说的"已配置的服务账号认证信息"。部署时把**整份 JSON 内容**粘进一个环境变量即可。

### 2）Google Cloud API key（`GCP_API_KEY`）
- 打开 https://console.cloud.google.com/ ，登录并选一个项目（没有就新建一个）。
- 在 "APIs & Services → Library" 里搜索并**启用**这两个 API：
  - **Cloud Translation API**
  - **Cloud Text-to-Speech API**
- 到 "APIs & Services → Credentials"，点 "Create Credentials → API key"，复制这串密钥，先存好。
- 该项目需要绑定结算账号（用量很低，自测通常几分钱到几毛钱）。

---

## 路线 A（推荐）：部署到 Vercel，拿到一个网址，无需在自己电脑装任何东西

1. **把项目放到 GitHub**
   - 注册 https://github.com/ ，新建一个仓库，把 `lingua-app` 这个文件夹上传上去（GitHub 网页上可以直接拖拽上传）。
   - 上传前请确认文件夹里**没有** `node_modules` 和 `.next`（这两个是自动生成的，很大，不需要上传）。

2. **部署到 Vercel**
   - 打开 https://vercel.com/ ，用 GitHub 账号登录，点 "Add New → Project"，选中你刚上传的仓库，点 Import。
   - 在 "Environment Variables" 里加这几条：
     - 名字 `GOOGLE_APPLICATION_CREDENTIALS_JSON`，值粘贴你**整份服务账号 JSON 的内容**（可以直接粘原始 JSON）。
     - 名字 `GCP_API_KEY`，值粘贴你的 Google Cloud API key。
     - （可选）名字 `GOOGLE_PROJECT_ID`，值填你的 GCP 项目 ID（默认 `lingua-tts-504817`）。
   - 点 Deploy，等一两分钟，就会得到一个 `https://...vercel.app` 的网址——这就是你可以分享给测试者的真实产品。

> 想改密钥，以后在 Vercel 后台点几下即可，不用碰代码。
> 部署完成后，打开 `你的网址/api/health` 可以逐项检查 Gemini、翻译、语音是否都连通（不会显示密钥，只显示是否正常）。

---

## 路线 B：在自己的 Mac 上本地运行（需要装 Node）

1. 安装 Node.js（一次性）：打开 https://nodejs.org/ ，下载 LTS 版本，一路下一步安装。
2. 打开「终端」App，把下面命令逐行粘贴回车（把路径换成 lingua-app 的实际位置）：
   ```
   cd ~/Desktop/LanguageLearning/lingua-app
   npm install
   cp .env.example .env.local
   ```
3. 用文本编辑器打开 `.env.local`：
   - 本地最简单的方式：把下载的服务账号 JSON 文件放到项目里（例如 `lingua-app/service-account.json`），然后写一行 `GOOGLE_APPLICATION_CREDENTIALS=./service-account.json`。（或者把整份 JSON 压成一行粘到 `GOOGLE_APPLICATION_CREDENTIALS_JSON=` 后面。）
   - 把你的 Google Cloud API key 粘到 `GCP_API_KEY=` 后面，保存。
   - ⚠️ 别把 `service-account.json` 传到 GitHub（`.gitignore` 里加一行 `service-account.json`）。
4. 回到终端运行：
   ```
   npm run dev
   ```
   然后浏览器打开 http://localhost:3000 就能看到真实内容版本。
   （不填密钥也能跑，只是内容是模拟的。）

---

## 填了密钥后，这些都是真实的
- 翻译：每句的翻译由 **Google Cloud Translation** 生成（`/api/analyze` 的 translate）。
- 课程内容与语法：词义 + 全新实用例句、逐句语法讲解、按你水平出的目标语选择题、AI 推荐学习材料，都由 **Gemini on Vertex AI** 生成（`/api/analyze`、`/api/lesson`）。
- 高质量语音朗读：所有朗读都用 **Google Cloud Text-to-Speech**（`/api/tts`）；没有密钥时自动退回浏览器自带声音。
- Part 1 写作反馈 + Part 2 AI 对话：由 **Gemini on Vertex AI** 实时生成（`/api/chat`）。

> 没有对应密钥时，以上功能会自动退回"模拟版本"，应用照常运行。

## 关于语音的一个小提示
浏览器（尤其 Safari）有时会拦截"自动连续播放"。逐句连读若被拦，点一下播放即可；Chrome 一般没问题。

## 花费与安全
- 全部走 Google Cloud 用量计费（文本走 Vertex AI，消耗你的 GCP 额度／试用赠金）。可在 Google Cloud 后台查看用量、设置额度上限。
- 服务账号 JSON 和 API key 都只存在服务器端环境变量里，不会出现在网页源码中。
