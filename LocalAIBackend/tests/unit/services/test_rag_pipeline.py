"""
Unit tests cho rag_pipeline.py — test logic thuần, không cần DB/LLM/ChromaDB.
"""
import pytest
from app.services.rag_pipeline import (
    _process_llm_citations,
    _fix_bullet_indentation,
    _is_summary_intent,
)


# ---------------------------------------------------------------------------
# _process_llm_citations
# ---------------------------------------------------------------------------

class TestProcessLlmCitations:
    def test_normal_citation(self):
        response = "Nội dung quan trọng. [A]"
        result, source_lines = _process_llm_citations(response, num_chunks=3)
        assert result == "Nội dung quan trọng. [1]"
        assert 0 in source_lines
        assert "Nội dung quan trọng." in source_lines[0][0]

    def test_marker_only_line_is_removed(self):
        """Dòng chỉ có markers không có text → phải bị xóa hoàn toàn."""
        response = "Câu trả lời.\n[A][B][C][D][E]"
        result, _ = _process_llm_citations(response, num_chunks=5)
        assert "[A]" not in result
        assert "[B]" not in result
        # Dòng marker-only không còn trong output
        lines = [l for l in result.split("\n") if l.strip()]
        assert all("[A]" not in l and "[B]" not in l for l in lines)

    def test_multiple_markers_picks_most_frequent(self):
        """[A][B][A] → A xuất hiện nhiều nhất → map sang [1]."""
        response = "Text [A][B][A]"
        result, source_lines = _process_llm_citations(response, num_chunks=3)
        assert "[1]" in result
        assert "[2]" not in result
        assert 0 in source_lines  # A → index 0

    def test_invalid_chunk_index_keeps_text(self):
        """[Z] = index 25, out of range nếu num_chunks=3 → giữ text, bỏ marker."""
        response = "Text quan trọng [Z]"
        result, source_lines = _process_llm_citations(response, num_chunks=3)
        assert "Text quan trọng" in result
        assert "[Z]" not in result
        assert len(source_lines) == 0  # không có citation nào được map

    def test_empty_response(self):
        result, source_lines = _process_llm_citations("", num_chunks=3)
        assert result == ""
        assert source_lines == {}

    def test_multiline_mixed(self):
        """Dòng có citation → convert. Dòng không có → giữ nguyên."""
        response = (
            "Mở đầu không citation.\n"
            "- Bullet với citation [B]\n"
            "- Bullet không citation\n"
            "[A][C]"  # marker-only line
        )
        result, source_lines = _process_llm_citations(response, num_chunks=3)
        lines = result.split("\n")

        assert lines[0] == "Mở đầu không citation."
        assert "[2]" in lines[1]   # B → index 1 → [2]
        assert lines[2] == "- Bullet không citation"
        # Dòng marker-only bị xóa
        assert not any("[A]" in l or "[C]" in l for l in lines)

    def test_citation_source_lines_populated(self):
        """citation_source_lines phải chứa text của dòng đã cite."""
        response = "Thông tin từ tài liệu A [A]\nThông tin từ tài liệu B [B]"
        _, source_lines = _process_llm_citations(response, num_chunks=3)
        assert 0 in source_lines
        assert 1 in source_lines
        assert "Thông tin từ tài liệu A" in source_lines[0][0]
        assert "Thông tin từ tài liệu B" in source_lines[1][0]


# ---------------------------------------------------------------------------
# _fix_bullet_indentation
# ---------------------------------------------------------------------------

class TestFixBulletIndentation:
    def test_indent_single_sub_bullet(self):
        text = "- **Header**\n- Sub content"
        result = _fix_bullet_indentation(text)
        lines = result.split("\n")
        assert lines[0] == "- **Header**"
        assert lines[1] == "  - Sub content"

    def test_indent_multiple_sub_bullets(self):
        """Nhiều sub-items liên tiếp đều phải được indent."""
        text = "- **Bước 1:**\n- Item A\n- Item B\n- Item C"
        result = _fix_bullet_indentation(text)
        lines = result.split("\n")
        assert lines[0] == "- **Bước 1:**"
        assert lines[1] == "  - Item A"
        assert lines[2] == "  - Item B"
        assert lines[3] == "  - Item C"

    def test_no_indent_plain_bullets(self):
        """Bullets bình thường không có bold header → không thay đổi."""
        text = "- Item A\n- Item B\n- Item C"
        result = _fix_bullet_indentation(text)
        assert result == text

    def test_blank_line_resets_state(self):
        """Dòng trống reset trạng thái → bullet sau blank không bị indent."""
        text = "- **Header**\n- Sub\n\n- NotASub"
        result = _fix_bullet_indentation(text)
        lines = result.split("\n")
        assert lines[1] == "  - Sub"
        assert lines[3] == "- NotASub"   # không bị indent

    def test_already_indented_not_double_indented(self):
        """Bullet đã có indent → không bị indent thêm lần nữa."""
        text = "- **Header**\n  - Already indented"
        result = _fix_bullet_indentation(text)
        lines = result.split("\n")
        assert lines[1] == "  - Already indented"  # vẫn 2 spaces, không phải 4

    def test_multiple_sections(self):
        """Nhiều bold headers liên tiếp với sub-items riêng."""
        text = (
            "- **Bước 1: Header A**\n"
            "- Sub A1\n"
            "- Sub A2\n"
            "- **Bước 2: Header B**\n"
            "- Sub B1\n"
        )
        result = _fix_bullet_indentation(text)
        lines = result.split("\n")
        assert lines[0] == "- **Bước 1: Header A**"
        assert lines[1] == "  - Sub A1"
        assert lines[2] == "  - Sub A2"
        assert lines[3] == "- **Bước 2: Header B**"
        assert lines[4] == "  - Sub B1"

    def test_non_bullet_line_resets_state(self):
        """Dòng không phải bullet reset state."""
        text = "- **Header**\n- Sub\nParagraph text\n- NotSub"
        result = _fix_bullet_indentation(text)
        lines = result.split("\n")
        assert lines[1] == "  - Sub"
        assert lines[3] == "- NotSub"   # sau paragraph → không indent


# ---------------------------------------------------------------------------
# _is_summary_intent
# ---------------------------------------------------------------------------

class TestIsSummaryIntent:
    @pytest.mark.parametrize("query", [
        "Tóm tắt nội dung tài liệu",
        "Tổng hợp các điểm chính",
        "Tổng quan về dự án",
        "Tóm lược báo cáo",
        "Hãy summary tài liệu này",
        "Overview của hệ thống là gì",
    ])
    def test_detects_summary_keywords(self, query):
        assert _is_summary_intent(query) is True

    @pytest.mark.parametrize("query", [
        "Quy trình thanh toán là gì?",
        "Ai chịu trách nhiệm phê duyệt?",
        "Hạn mức chi tiêu tối đa là bao nhiêu?",
        "Deadline của dự án là khi nào?",
    ])
    def test_non_summary_queries(self, query):
        assert _is_summary_intent(query) is False
