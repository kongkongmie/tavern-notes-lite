# 酒馆笔记 Lite / Tavern Notes Lite

酒馆笔记 Lite 是无需 Server Plugin 的纯前端版本。笔记保存在当前浏览器的 IndexedDB 中，适合无法安装后端、希望直接通过 SillyTavern 扩展管理器安装的用户。

## 与完整版的区别

- Lite：纯前端、本机当前浏览器保存、安装简单。
- Full：文件保存、多设备共享、适合长期大量笔记。
- 两版通过 `tavern-notes-export` JSON 手动迁移数据。
- 同时安装时，完整版优先，Lite 会暂停运行，避免重复摘录。

## 安装

在 SillyTavern 的“安装扩展”中粘贴 Lite 仓库地址。安装后刷新页面即可使用，不需要运行 BAT、SH 或安装 Server Plugin。

## 数据提醒

清理浏览器数据、换浏览器或换设备前，请先导出 JSON。Lite 不会自动删除笔记。
