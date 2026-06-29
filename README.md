# MediaTagger

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Release](https://img.shields.io/github/v/release/acliunianc/media-tagger)](https://github.com/acliunianc/media-tagger/releases)
[![CI](https://github.com/acliunianc/media-tagger/actions/workflows/ci.yml/badge.svg)](https://github.com/acliunianc/media-tagger/actions/workflows/ci.yml)

基于 **Tauri v2 + React + Rust** 的本地媒体标签管理桌面应用。通过 **内容哈希（blake3）** 绑定标签，文件移动或重命名后标签依然跟随；数据纯本地存储，无需联网。

[English](#english) · [下载安装](#下载安装) · [从源码构建](#从源码构建) · [发布流程](#发布流程)

## 功能特性

- **文件夹扫描**：多目录、通配符排除、进度推送、暂停/继续
- **标签管理**：按内容哈希绑定，支持移动/重命名/恢复后自动关联
- **搜索与筛选**：文件名/路径/标签搜索，AND/OR 逻辑，类型/状态/标签多维筛选
- **文件夹树**：按扫描根目录浏览与过滤
- **批量操作**：多选后右键批量添加/移除标签
- **导入导出**：JSON 格式标签数据，支持合并与替换模式
- **媒体预览**：图片全屏预览、视频全屏播放
- **虚拟滚动**：海量文件列表流畅渲染

## 下载安装

前往 [GitHub Releases](https://github.com/acliunianc/media-tagger/releases) 下载对应平台的安装包：

| 平台 | 格式 |
| ---- | ---- |
| Windows | `.msi` / `.exe` |
| macOS | `.dmg` / `.app` |
| Linux | `.deb` / `.AppImage` |

> 首次运行若遇系统安全提示，请允许来自该发布者的应用。

## 从源码构建

### 环境要求

- [Node.js](https://nodejs.org/) 18+
- [pnpm](https://pnpm.io/) 9+
- [Rust](https://www.rust-lang.org/tools/install) stable
- 平台依赖见 [Tauri 官方文档](https://v2.tauri.app/start/prerequisites/)

### 开发

```bash
git clone https://github.com/acliunianc/media-tagger.git
cd media-tagger
pnpm install
pnpm tauri dev
```

### 打包

```bash
pnpm tauri build
```

产物位于 `src-tauri/target/release/bundle/`。

## 发布流程

本项目通过 GitHub Actions 自动构建并发布到 **Releases**（非 npm Packages）。

1. 更新 `package.json`、`src-tauri/tauri.conf.json`、`src-tauri/Cargo.toml` 中的版本号
2. 在 `CHANGELOG.md` 中记录变更
3. 提交并推送 tag：

```bash
git add .
git commit -m "chore: release v1.0.1"
git tag v1.0.1
git push origin main --tags
```

4. GitHub Actions 会自动构建 Windows / macOS / Linux 安装包并创建 [Release](https://github.com/acliunianc/media-tagger/releases)

## 项目结构

```
media-tagger/
├── src/                 # React 前端
├── src-tauri/           # Rust 后端与 Tauri 配置
├── .github/workflows/   # CI / Release 自动化
└── docs/                # 开发文档
```

## 贡献

欢迎提交 Issue 与 Pull Request。开发规格见 [docs/SPEC.md](docs/SPEC.md)。

## 许可证

本项目采用 [MIT License](LICENSE) 开源，可免费使用、修改与分发。

---

## English

**MediaTagger** is a cross-platform desktop app for tagging local media files (images, videos, audio). Tags are bound to file **content hashes (blake3)**, so they persist across moves and renames. All data stays on your machine.

- **Download**: [GitHub Releases](https://github.com/acliunianc/media-tagger/releases)
- **Build**: `pnpm install && pnpm tauri dev`
- **License**: [MIT](LICENSE)
