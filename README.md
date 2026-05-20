# 今日待办

一个面向个人使用的 TODO、提醒和回顾网站。当前版本是可直接运行的静态 Web 应用，默认使用浏览器本地存储，并支持同一浏览器多个页面之间实时同步。

## 当前已实现

- 首页：今日待办、即将提醒、日历与计划、本周回顾、过去完成
- 待办：新增、完成/恢复、延期、删除、分类、优先级、截止时间
- 提醒：新增提醒、重复标记、网页/App 渠道标记
- 回顾：自动记录新建、完成、延期、删除等操作历史
- 同步：`localStorage` 持久化，`BroadcastChannel` 多标签页同步
- 设置：浏览器通知权限入口

## 本地运行

```bash
python3 -m http.server 8000
```

然后访问：

```text
http://localhost:8000
```

## 云端同步准备

如果你希望多设备、多浏览器、未来 App 共同使用，需要创建 Supabase 项目。

你需要准备：

- Supabase 账号
- Supabase 项目 URL
- Supabase anon public key

创建项目后：

1. 在 Supabase SQL Editor 里执行 `supabase-schema.sql`
2. 复制 `config.example.js` 为 `config.js`
3. 填入 Supabase 项目配置

```js
window.TODO_SUPABASE_URL = "https://your-project.supabase.co";
window.TODO_SUPABASE_ANON_KEY = "your-anon-key";
```

`config.js` 只用于本地开发，已经被 `.gitignore` 忽略，不要提交真实配置。GitHub Pages 部署时会通过仓库 Secrets 生成这个文件：

- `TODO_SUPABASE_URL`
- `TODO_SUPABASE_ANON_KEY`

## 下一步建议

当前代码已经支持 Supabase 邮箱登录、云端读写、本地数据迁移和 Realtime 订阅。第一次使用时：

1. 在设置页注册或登录邮箱账号
2. 如果 Supabase 要求邮箱确认，先点击确认邮件，再回到网页登录
3. 登录成功后，本地数据会自动迁移到云端

## 后续可继续增强

- Web Push 或 App Push，用于网页关闭后的提醒
- React Native / Expo App，共用同一套 Supabase 数据库
