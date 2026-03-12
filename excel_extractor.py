"""读取 Excel 并按指定类别提取内容。

用法示例：
    python excel_extractor.py \
        --input data.xlsx \
        --category-column 类别 \
        --categories 水果,蔬菜 \
        --columns 名称,价格 \
        --output result.xlsx
"""

from __future__ import annotations

import argparse
from pathlib import Path
from typing import Iterable, Sequence

import pandas as pd


def extract_by_categories(
    input_file: str | Path,
    category_column: str,
    categories: Sequence[str],
    columns: Sequence[str] | None = None,
    sheet_name: str | int = 0,
) -> pd.DataFrame:
    """从 Excel 中按类别筛选并返回结果 DataFrame。

    参数:
        input_file: Excel 文件路径。
        category_column: 表示类别的列名。
        categories: 需要保留的类别列表。
        columns: 需要输出的列名列表；为 None 时输出所有列。
        sheet_name: 工作表名称或索引，默认第一个工作表。

    返回:
        筛选后的 DataFrame。
    """
    df = pd.read_excel(input_file, sheet_name=sheet_name)

    if category_column not in df.columns:
        raise ValueError(
            f"找不到类别列 '{category_column}'。可用列: {list(df.columns)}"
        )

    missing_categories = [c for c in categories if c not in set(df[category_column].dropna())]
    if missing_categories:
        print(f"警告：以下类别在数据中不存在: {missing_categories}")

    filtered = df[df[category_column].isin(categories)].copy()

    if columns is not None:
        missing_columns = [col for col in columns if col not in filtered.columns]
        if missing_columns:
            raise ValueError(
                f"以下列不存在: {missing_columns}。可用列: {list(filtered.columns)}"
            )
        filtered = filtered.loc[:, list(columns)]

    return filtered


def save_result(df: pd.DataFrame, output_file: str | Path) -> None:
    """将结果保存到 Excel 或 CSV。"""
    output_path = Path(output_file)
    if output_path.suffix.lower() == ".csv":
        df.to_csv(output_path, index=False, encoding="utf-8-sig")
    else:
        df.to_excel(output_path, index=False)


def _split_csv_like(value: str) -> list[str]:
    return [v.strip() for v in value.split(",") if v.strip()]


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="读取 Excel 并按类别提取内容")
    parser.add_argument("--input", required=True, help="输入 Excel 文件路径")
    parser.add_argument("--sheet", default="0", help="工作表名或索引（默认 0）")
    parser.add_argument("--category-column", required=True, help="类别列名")
    parser.add_argument(
        "--categories",
        required=True,
        help="要提取的类别，英文逗号分隔，例如：水果,蔬菜",
    )
    parser.add_argument(
        "--columns",
        default=None,
        help="输出列名，英文逗号分隔；不填则输出全部列",
    )
    parser.add_argument("--output", default="extracted.xlsx", help="输出文件路径")
    return parser.parse_args()


def main() -> None:
    args = _parse_args()

    sheet: str | int
    sheet = int(args.sheet) if args.sheet.isdigit() else args.sheet

    categories = _split_csv_like(args.categories)
    columns = _split_csv_like(args.columns) if args.columns else None

    result = extract_by_categories(
        input_file=args.input,
        category_column=args.category_column,
        categories=categories,
        columns=columns,
        sheet_name=sheet,
    )
    save_result(result, args.output)

    print(f"提取完成，共 {len(result)} 行，已保存到: {args.output}")


if __name__ == "__main__":
    main()
