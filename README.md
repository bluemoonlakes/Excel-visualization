# 话术知识库

基于 Flask + SQLite 的话术数据可视化管理系统。支持 Excel 导入、图片素材库管理、多维度筛选与搜索，适用于销售话术、知识库等场景。

---

## 功能特性

### 1. Excel 导入
- 支持  /  格式导入
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
- **文件名规范**： 或 
- 支持批量上传、自动解析文件名标签
- 同一三级组合自动覆盖更新

### 4. 卡片内独立图片选择
- 每张卡片独立维护自己的 Level 2 / Level 3 选择
- 选择器互不干扰
- 支持不显示图片选项
- 支持通用选项（无括号文件名）

### 5. 一键收起/展开选择器
- 单张卡片右上角小按钮独立控制
- 页面顶部收起全部/展开全部一键控制
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



---

## 快速开始

### 1. 安装依赖

Requirement already satisfied: flask>=3.0.0 in C:\Users\User\AppData\Local\hermes\hermes-agent\venv\Lib\site-packages (from -r requirements.txt (line 1)) (3.1.3)
Requirement already satisfied: openpyxl>=3.1.0 in C:\Users\User\AppData\Local\hermes\hermes-agent\venv\Lib\site-packages (from -r requirements.txt (line 2)) (3.1.5)
Requirement already satisfied: Pillow>=10.0.0 in C:\Users\User\AppData\Local\hermes\hermes-agent\venv\Lib\site-packages (from -r requirements.txt (line 3)) (12.2.0)
Requirement already satisfied: python-dotenv>=1.0.0 in C:\Users\User\AppData\Local\hermes\hermes-agent\venv\Lib\site-packages (from -r requirements.txt (line 4)) (1.2.2)
Requirement already satisfied: blinker>=1.9.0 in C:\Users\User\AppData\Local\hermes\hermes-agent\venv\Lib\site-packages (from flask>=3.0.0->-r requirements.txt (line 1)) (1.9.0)
Requirement already satisfied: click>=8.1.3 in C:\Users\User\AppData\Local\hermes\hermes-agent\venv\Lib\site-packages (from flask>=3.0.0->-r requirements.txt (line 1)) (8.4.0)
Requirement already satisfied: itsdangerous>=2.2.0 in C:\Users\User\AppData\Local\hermes\hermes-agent\venv\Lib\site-packages (from flask>=3.0.0->-r requirements.txt (line 1)) (2.2.0)
Requirement already satisfied: jinja2>=3.1.2 in C:\Users\User\AppData\Local\hermes\hermes-agent\venv\Lib\site-packages (from flask>=3.0.0->-r requirements.txt (line 1)) (3.1.6)
Requirement already satisfied: markupsafe>=2.1.1 in C:\Users\User\AppData\Local\hermes\hermes-agent\venv\Lib\site-packages (from flask>=3.0.0->-r requirements.txt (line 1)) (3.0.3)
Requirement already satisfied: werkzeug>=3.1.0 in C:\Users\User\AppData\Local\hermes\hermes-agent\venv\Lib\site-packages (from flask>=3.0.0->-r requirements.txt (line 1)) (3.1.8)
Requirement already satisfied: et-xmlfile in C:\Users\User\AppData\Local\hermes\hermes-agent\venv\Lib\site-packages (from openpyxl>=3.1.0->-r requirements.txt (line 2)) (2.0.0)
Requirement already satisfied: colorama in C:\Users\User\AppData\Local\hermes\hermes-agent\venv\Lib\site-packages (from click>=8.1.3->flask>=3.0.0->-r requirements.txt (line 1)) (0.4.6)

依赖包含：   

### 2. 启动服务

 * Serving Flask app 'app'
 * Debug mode: on

服务默认运行在 

### 3. 使用

| 页面 | URL | 功能 |
|---|---|---|
| 展示页 |  | 查看话术卡片，筛选、搜索、切换图片 |
| 管理后台 |  | Excel 导入、素材库管理 |

### 4. 配置说明

 中可修改以下配置项：

-  — Excel 列名映射到 Level 1 标签
-  — Excel 列名映射到 Level 3 标签
-  — 图片压缩尺寸
-  — 图片压缩质量
-  — 默认每页数量

---

## 图片素材库使用说明

### 文件名规范

素材库根据文件名自动解析三级标签：



示例：
- 
  - Level 1: 
  - Level 2: 
  - Level 3: 

- 
  - Level 1: 
  - Level 2: 
  - Level 3: （无括号时默认为空）

### 上传方式

在后台  → 素材库 Tab 中，批量拖拽或点选上传。同一  组合会自动覆盖旧文件。

---

## 数据库表结构

| 表名 | 说明 |
|---|---|
|  | Excel 导入记录 |
|  | 话术卡片数据（JSON 存储） |
|  | 字段显示配置 |
|  | 筛选选项及计数 |
|  | 图片素材库三级标签 |
|  | 图片显示规则（兼容保留） |
|  | 应用设置 |

---

## 开发注意事项

- SQLite 需要 3.38+ 版本（支持 JSON1 扩展）
- 图片上传后会自动压缩至 ，保存为 JPEG
-  目录下的文件不纳入 Git 版本控制

---

## License

MIT
