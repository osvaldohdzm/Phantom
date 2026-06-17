"""Pruebas de listas de etiquetas (grupos/subgrupos)."""

from app.services.tag_list import format_tag_list, merge_tag_lists, parse_tag_list


def test_parse_tag_list_splits_semicolon_comma_pipe():
    assert parse_tag_list("A; B, C | D") == ["A", "B", "C", "D"]


def test_parse_tag_list_dedupes_case_insensitive():
    assert parse_tag_list("pci; PCI; Pci") == ["pci"]


def test_merge_tag_lists_preserves_order_and_dedupes():
    assert merge_tag_lists(["A", "B"], "B; C", None) == ["A", "B", "C"]


def test_format_tag_list_joins_with_separator():
    assert format_tag_list(["PCI", "Indeval"]) == "PCI · Indeval"
