# 安装 WordPress 插件步骤

## 📦 插件文件

插件文件已经生成好了：`rideinchina-complete.php`

## 📝 安装步骤

### 方式一：通过 FTP / 文件管理器（推荐）

1. **找到你的 WordPress 目录**
   - 通常在 `/var/www/html/` 或你的主机根目录

2. **进入插件文件夹**
   ```
   /wp-content/plugins/
   ```

3. **创建插件文件夹**
   - 在 `plugins` 目录下新建文件夹：`rideinchina-complete`

4. **上传插件文件**
   - 把 `rideinchina-complete.php` 上传到刚创建的文件夹里
   - 最终路径：`/wp-content/plugins/rideinchina-complete/rideinchina-complete.php`

5. **激活插件**
   - 登录 WordPress 后台
   - 进入 **插件 → 已安装的插件**
   - 找到 "Ride In China Complete API"
   - 点击 **启用**

### 方式二：通过 WordPress 后台上传

1. **打包成 zip**（先做这步）
   - 把 `rideinchina-complete.php` 放进一个叫 `rideinchina-complete` 的文件夹
   - 把这个文件夹打包成 `rideinchina-complete.zip`

2. **上传插件**
   - WordPress 后台 → **插件 → 安装插件**
   - 点击 **上传插件**
   - 选择刚才的 `rideinchina-complete.zip`
   - 点击 **现在安装**

3. **激活插件**
   - 安装完成后点击 **启用插件**

---

## ✅ 验证安装成功

### 测试接口是否可用

在浏览器访问：
```
https://你的域名.com/wp-json/wp/v2/rideinchina/group-locations
```

**预期结果**：
- 如果未登录：返回 401 错误（正常，说明接口存在但需要登录）
- 如果已登录：返回 `{"riders":[]}`（说明接口正常工作）

---

## 🔑 设置管理员权限

### 方式一：用 WordPress 管理员账号

如果你已经是 WordPress 的**管理员**：
- 直接用这个账号在 App 里登录
- 自动拥有 App 管理员权限

### 方式二：给普通用户添加管理员权限

1. WordPress 后台 → **用户 → 所有用户**
2. 点击要设置的用户 → **编辑**
3. 向下滚动找到 **自定义字段（Custom Fields）**
4. 添加新字段：
   - **名称**：`rideinchina_role`
   - **值**：`admin`（或 `leader`）
5. 点击 **添加自定义栏目** → **更新用户**

---

## 🚀 新增功能说明

安装这个插件后，App 会新增以下功能：

### 1. 群位置共享（核心新增）
- **功能**：在地图上看到队友实时位置
- **接口**：
  - `POST /rideinchina/group-locations` ← App 每5秒上报位置
  - `GET /rideinchina/group-locations` ← App 每5秒拉取队友位置
- **数据**：经纬度、速度、海拔、方向
- **清理**：超过10分钟未更新的位置会自动删除

### 2. 群消息（已支持图片/视频）
- 支持管理员/领队发文字、图片、视频
- 消息高亮显示

### 3. 群目的地
- 领队设置群目的地
- 所有人看到统一集合点

### 4. 管理员功能
- 审核用户证件
- 管理用户角色
- 查看群消息

---

## ⚠️ 注意事项

1. **JWT 认证插件**
   - 本插件依赖 JWT 认证
   - 确保你已经安装并配置了 `JWT Authentication for WP REST API` 插件

2. **权限问题**
   - 如果接口返回 403，检查用户是否有正确的角色（admin/leader）
   - 群位置共享需要**登录**才能用

3. **性能**
   - 群位置数据存在 WordPress options 表
   - 会自动清理过期位置（10分钟）
   - 不会占用太多空间

---

## 🆘 常见问题

### Q: 插件激活后没看到任何变化？
A: 这是正常的！这个插件只提供 **后端接口**，没有 WordPress 后台界面。功能全在 App 里。

### Q: 如何测试群位置共享是否工作？
A: 
1. 用手机打开 App 地图
2. 用另一个手机（或浏览器）登录另一个账号
3. 两个设备都打开地图
4. 应该能看到对方的位置点出现在地图上

### Q: 位置不更新怎么办？
A: 
- 检查手机是否允许浏览器访问位置
- 确保网络连接正常
- 刷新一下 App（关闭重开）

---

有问题可以查看 `ADMIN_SETUP.md` 了解更多管理员设置细节。
