<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/19bR8IC-uQb0ChvlgVy8rWixmFeoOGUJB

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## 管理员与 WordPress

- **管理员账号**：在 WordPress 后台将用户设为“管理员”，或为用户添加自定义字段 `rideinchina_role` = `admin`。详见 [ADMIN_SETUP.md](ADMIN_SETUP.md)。
- **查看用户上传的证件/图片**：登录后底部进入 **Admin** → **Documents**，可预览、通过/拒绝。
- **群聊**：Admin 或领队可在 **Messages** 中发文字、图片、视频；管理员/领队消息会高亮显示。
