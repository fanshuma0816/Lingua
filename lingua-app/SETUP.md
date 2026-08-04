# Lingua — 上线指南（给非技术用户）

这是产品的「真实版」项目。它和你之前的原型体验完全一样,但课程内容、翻译、词义例句、选择题可以由真实的 AI 生成,而不是模拟的。

**核心原理:** 只要你填入一个 OpenAI 密钥,内容就变真的;不填,它照常运行,只是用内置的模拟内容。密钥永远只存在服务器端,不会暴露在浏览器里(这也是我们从单文件原型升级到 Next.js 的原因)。

---

## 路线 A(推荐):部署到 Vercel,拿到一个网址,无需在自己电脑装任何东西

1. **拿一个 OpenAI 密钥**
   - 打开 https://platform.openai.com/ ,注册并登录。
   - 进入 API keys 页面,点 "Create new secret key",复制这串以 `sk-` 开头的密钥,先存好。
   - 需要在 Billing 里绑定一张卡并充一点额度(自测很便宜,每堂课几美分)。

2. **把项目放到 GitHub**
   - 注册 https://github.com/ ,新建一个仓库,把 `lingua-app` 这个文件夹上传上去(GitHub 网页上可以直接拖拽上传)。

3. **部署到 Vercel**
   - 打开 https://vercel.com/ ,用 GitHub 账号登录,点 "Add New → Project",选中你刚上传的仓库,点 Import。
   - 在 "Environment Variables" 里加一条:名字填 `OPENAI_API_KEY`,值粘贴你的密钥。
   - 点 Deploy,等一两分钟,就会得到一个 `https://...vercel.app` 的网址——这就是你可以分享给测试者的真实产品。

> 想改内容或改密钥,以后在 Vercel 后台点几下即可,不用碰代码。

---

## 路线 B:在自己的 Mac 上本地运行(需要装 Node)

1. 安装 Node.js(一次性):打开 https://nodejs.org/ ,下载 LTS 版本,一路下一步安装。
2. 打开「终端」App,把下面命令逐行粘贴回车(把路径换成 lingua-app 的实际位置):
   ```
   cd ~/Desktop/LanguageLearning/lingua-app
   npm install
   cp .env.example .env.local
   ```
3. 用文本编辑器打开 `.env.local`,在 `OPENAI_API_KEY=` 后面粘上你的密钥,保存。
4. 回到终端运行:
   ```
   npm run dev
   ```
   然后浏览器打开 http://localhost:3000 就能看到真实内容版本。
   (不填密钥也能跑,只是内容是模拟的。)

---

## 这一版已经接真实 AI 的部分
- 课程内容:每句的英文翻译、每个词的释义 + 全新实用例句、按你水平出的目标语选择题(`/api/lesson` → OpenAI)。

## 还是模拟、留待下一步接入的部分
- 高质量语音朗读:`/api/tts` 路由已写好(接入后全文朗读会用 OpenAI 高质量语音);目前句子朗读仍用浏览器自带声音。
- Part 1 写作反馈 和 Part 2 AI 对话:目前是示例文案,下一步接入 `/api/chat` 即为真实互动。

## 花费与安全
- 按用量付费,自测阶段很低。可在 OpenAI 后台设置每月上限。
- 密钥只存在服务器端环境变量里,不会出现在网页源码中。
