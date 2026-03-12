# codex-test

一个简单的 Excel 分类提取脚本：`excel_extractor.py`。

## 功能
- 读取 Excel 文件
- 按指定“类别列”筛选指定类别的数据
- 可选择只保留部分列
- 可导出为 `.xlsx` 或 `.csv`

## 安装依赖
```bash
pip install pandas openpyxl
```

## 命令行用法
```bash
python excel_extractor.py \
  --input data.xlsx \
  --sheet 0 \
  --category-column 类别 \
  --categories 水果,蔬菜 \
  --columns 名称,价格 \
  --output result.xlsx
```

## 作为函数调用
```python
from excel_extractor import extract_by_categories

result_df = extract_by_categories(
    input_file="data.xlsx",
    category_column="类别",
    categories=["水果", "蔬菜"],
    columns=["名称", "价格"],
    sheet_name=0,
)

print(result_df)
```
