import os

BASE_DIR = os.path.abspath(os.path.dirname(__file__))

DATABASE_PATH = os.path.join(BASE_DIR, 'app.db')
UPLOAD_EXCELS = os.path.join(BASE_DIR, 'uploads', 'excels')
UPLOAD_IMAGES = os.path.join(BASE_DIR, 'uploads', 'images')
UPLOAD_MEDIA  = os.path.join(BASE_DIR, 'uploads', 'images', 'media')

ALLOWED_EXCEL_EXTENSIONS = {'.xlsx', '.xls'}
ALLOWED_IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.gif', '.webp'}
MAX_IMAGE_SIZE = (1920, 1920)
IMAGE_QUALITY = 85

FILTERABLE_THRESHOLD = 20

# 素材库：Excel 列名映射 → 图片三级标签
LEVEL1_COLUMN = '\u95ee\u9898\u7c7b\u578b'   # 问题类型
LEVEL3_COLUMN = '\u56e2\u961f'               # 团队
