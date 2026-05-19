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
  - Level 1: 问题类型（从 Excel 自动匹配）
  - Level 2: 素材类型（如服务介绍、话术模板）
  - Level 3: 团队 / 通用（文件名括号内内容）
- **文件名规范**：`{level1}_{level2}_{描述}.jpg` 或 `{level1}_{level2}_{描述}（{level3}）.jpg`
- 支持批量上传、自动解析文件名标签
- 同一三级组合自动覆盖更新

### 4. 卡片内独立图片选择
- 每张卡片独立维护自己的 Level 2 / Level 3 选择
- 选择器互不干扰
- 支持"不显示图片"选项
- 支持"通用"选项（无括号文件名）

### 5. 一键收起/展开选择器
- 单张卡片右上角小按钮独立控制
- 页面顶部"收起全部"/"展开全部"一键控制
- 折叠动画平滑过渡

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
├── app.py                    # Flask 应用入口
├── config.py                 # 配置文件
├── requirements.txt          # Python 依赖
├── models/
│   └── database.py           # SQLite 数据库初始化与连接
├── routes/
│   ├── admin_routes.py       # 管理后台 API
│   └── card_routes.py        # 展示页 API
├── services/
│   ├── card_service.py       # 卡片业务逻辑（SQL 分页）
│   ├── config_service.py     # 配置业务逻辑
│   ├── excel_parser.py       # Excel 解析导入
│   └── media_service.py      # 素材库业务逻辑
├── templates/
│   ├── index.html            # 展示页
│   └── admin.html            # 管理后台
├── static/
│   ├── css/
│   │   ├── main.css          # 全局样式
│   │   ├── cards.css         # 展示页样式
│   │   └── admin.css         # 后台样式
│   └── js/
│       ├── api.js            # API 封装
│       ├── cards.js          # 展示页脚本
│       └── admin.js          # 后台脚本
└── uploads/                  # 上传文件存放
    ├── excels/               # Excel 文件
    └── images/               # 图片文件
        └── media/            # 素材库图片
```

---

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

依赖包含：`flask>=3.0.0` `openpyxl>=3.1.0` `Pillow>=10.0.0` `python-dotenv>=1.0.0`

### 2. 启动服务

```bash
python app.py
```

服务默认运行在 `http://localhost:5000`

### 3. 使用

| 页面 | URL | 功能 |
|---|---|---|
| 展示页 | `/` | 查看话术卡片，筛选、搜索、切换图片 |
| 管理后台 | `/admin` | Excel 导入、素材库管理 |

### 4. 配置说明

`config.py` 中可修改以下配置项：

- `LEVEL1_COLUMN` — Excel 列名映射到 Level 1 标签
- `LEVEL3_COLUMN` — Excel 列名映射到 Level 3 标签
- `MAX_IMAGE_SIZE` — 图片压缩尺寸
- `IMAGE_QUALITY` — 图片压缩质量
- `page_size` — 默认每页数量

---

## 图片素材库使用说明

### 文件名规范

素材库根据文件名自动解析三级标签：

```
{level1}_{level2}_{描述}（{level3}）.扩展名
```

示例：
- `问套餐_服务介绍_汇正财经牛人掌股王者团队核心服务及尊享功能服务介绍_001（杨）.jpg`
  - Level 1: `问套餐`
  - Level 2: `服务介绍`
  - Level 3: `杨`

- `问套餐_话术模板_标准话术模板_003.jpg`
  - Level 1: `问套餐`
  - Level 2: `话术模板`
  - Level 3: `通用`（无括号时默认为空）

### 上传方式

在后台 `/admin` → "素材库" Tab 中，批量拖拽或点选上传。同一 `(level1, level2, level3)` 组合会自动覆盖旧文件。

---

## 数据库表结构

| 表名 | 说明 |
|---|---|
| `excel_imports` | Excel 导入记录 |
| `cards` | 话术卡片数据（JSON 存储） |
| `column_configs` | 字段显示配置 |
| `filter_options` | 筛选选项及计数 |
| `media_assets` | 图片素材库三级标签 |
| `image_visibility_rules` | 图片显示规则（兼容保留） |
| `app_settings` | 应用设置 |

---

## 开发注意事项

- SQLite 需要 3.38+ 版本（支持 JSON1 扩展）
- 图片上传后会自动压缩至 `MAX_IMAGE_SIZE`，保存为 JPEG
- `uploads/` 目录下的文件不纳入 Git 版本控制

---

## License

MIT
