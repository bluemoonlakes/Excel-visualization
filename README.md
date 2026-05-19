# 话术知识库

基于 Flask + SQLite 的话术数据可视化管理系统。支持 Excel 导入、图片素材库管理、多维度筛选与搜索，适用于销售话术、知识库等场景。

---

## 功能特性

### 1. Excel 导入
- 支持 `.xlsx` / `.xls` 格式导入
- 自动识别字段类型（标签 / 文本）
- 自动生成筛选维度与可筛选值
- SQL 层面分页，支持大数据量

### 2. 卡片展示
- 网格布局，响应式设计
- 多维度筛选与关键词搜索
- 分页加载（加载更多）
- 详情弹窗展示完整话术内容

### 3. 图片素材库
- **三级标签体系**：
  - Level 1：问题类型（从 Excel 自动匹配）
  - Level 2：素材类型（如服务介绍、话术模板）
  - Level 3：团队 / 通用（文件名括号内内容）
- **文件名规范**：`问题类型_素材类型_描述（团队）.jpg`
- 支持批量上传、自动解析文件名标签
- 相同三级组合可重复上传，多张图片会同时保留，展示时可左右切换
- 图片下方自动显示描述文字

### 4. 卡片内独立图片选择
- 每张卡片独立维护自己的 Level 2 / Level 3 选择
- 选择器互不干扰，状态通过 localStorage 持久化
- 支持"不显示"选项
- 支持通用选项（无括号文件名）

### 5. 一键收起/展开选择器
- 单张卡片右上角小按钮独立控制
- 页面顶部收起全部 / 展开全部一键控制
- 折叠动画平滑过渡

### 6. 数据管理
- 后台数据管理 Tab 支持逐条编辑、删除
- 编辑弹窗展示所有字段，修改后实时保存

---

## 技术栈

| 层 | 技术 |
|---|---|
| 后端 | Flask 3.0+ |
| 数据库 | SQLite 3.38+（含 JSON1 扩展） |
| Excel 解析 | openpyxl |
| 图片处理 | Pillow |
| 前端 | 原生 HTML / CSS / JS |

---

## 目录结构

```
demo/
├── app.py                  # 应用入口
├── config.py               # 配置项
├── requirements.txt
├── models/
│   └── database.py         # SQLite 初始化 & 连接
├── routes/
│   ├── admin_routes.py     # 后台管理 API
│   └── card_routes.py      # 卡片展示 API
├── services/
│   ├── card_service.py     # 卡片查询 & 图片映射
│   ├── config_service.py   # 字段配置
│   ├── excel_parser.py     # Excel 解析导入
│   └── media_service.py    # 素材库解析 & 存储
├── static/
│   ├── css/
│   │   ├── main.css
│   │   ├── cards.css
│   │   └── admin.css
│   └── js/
│       ├── api.js
│       ├── cards.js
│       └── admin.js
├── templates/
│   ├── index.html          # 卡片展示页
│   └── admin.html          # 后台管理页
└── uploads/                # 自动创建，不纳入 Git
    ├── excels/
    └── images/
        └── media/          # 素材库图片
```

---

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

依赖包含：`flask` `openpyxl` `Pillow` `python-dotenv`

### 2. 启动服务

```bash
python app.py
```

服务默认运行在 `http://127.0.0.1:5000`

### 3. 使用

| 页面 | URL | 功能 |
|---|---|---|
| 展示页 | `http://127.0.0.1:5000/` | 查看话术卡片，筛选、搜索、切换图片 |
| 管理后台 | `http://127.0.0.1:5000/admin` | Excel 导入、字段配置、数据管理、素材库 |

### 4. 配置说明

`config.py` 中可修改以下配置项：

- `LEVEL1_COLUMN` — Excel 列名映射到 Level 1 标签（默认：`问题类型`）
- `LEVEL3_COLUMN` — Excel 列名映射到 Level 3 标签（默认：`团队`）
- `MAX_IMAGE_SIZE` — 图片压缩尺寸（默认：`1920×1920`）
- `IMAGE_QUALITY` — 图片压缩质量（默认：`85`）
- `FILTERABLE_THRESHOLD` — 筛选选项最大数量阈值（默认：`20`）

---

## 图片素材库使用说明

### 文件名规范

素材库根据文件名自动解析三级标签：

```
问题类型_素材类型_描述（团队）.jpg
```

示例：

- `核心服务_服务介绍_掌股核心服务_001（杨）.jpg`
  - Level 1：`核心服务`
  - Level 2：`服务介绍`
  - Level 3：`杨`
  - 描述：`掌股核心服务_001`

- `核心服务_话术模板.jpg`
  - Level 1：`核心服务`
  - Level 2：`话术模板`
  - Level 3：（空，归入通用）

### 上传方式

在后台 `/admin` → **素材库** Tab 中，批量拖拽或点选上传。相同三级组合可多次上传，所有图片同时保留，展示时左右切换。

---

## 数据库表结构

| 表名 | 说明 |
|---|---|
| `excel_imports` | Excel 导入记录 |
| `cards` | 话术卡片数据（JSON 存储） |
| `column_configs` | 字段显示配置 |
| `filter_options` | 筛选选项及计数 |
| `media_assets` | 图片素材库三级标签 |
| `app_settings` | 应用设置 |

---

## 开发注意事项

- SQLite 需要 3.38+ 版本（支持 JSON1 扩展）
- 图片上传后会自动压缩至 `1920×1920` 以内，JPEG 质量 85
- `uploads/` 目录下的文件不纳入 Git 版本控制

---

## License

MIT
