"""
Unit tests cho context_manager.py
"""
import pytest
from app.services.context_manager import format_history_block, needs_rewrite


class TestFormatHistoryBlock:
    def test_empty_history_returns_empty_string(self):
        assert format_history_block([]) == ""

    def test_single_user_message(self):
        history = [{"role": "user", "content": "Câu hỏi của tôi"}]
        result = format_history_block(history)
        assert "[LỊCH SỬ HỘI THOẠI GẦN ĐÂY]" in result
        assert "Người dùng: Câu hỏi của tôi" in result
        assert "[HẾT LỊCH SỬ]" in result

    def test_user_and_assistant_messages(self):
        history = [
            {"role": "user", "content": "Hỏi"},
            {"role": "assistant", "content": "Trả lời"},
        ]
        result = format_history_block(history)
        assert "Người dùng: Hỏi" in result
        assert "Trợ lý: Trả lời" in result

    def test_block_structure_preserved(self):
        history = [{"role": "user", "content": "Q"}]
        result = format_history_block(history)
        assert result.startswith("[LỊCH SỬ HỘI THOẠI GẦN ĐÂY]\n")
        assert result.endswith("[HẾT LỊCH SỬ]\n")


class TestNeedsRewrite:
    def test_no_history_always_false(self):
        assert needs_rewrite("nó là gì?", history=[]) is False

    def test_short_ambiguous_query_with_pronoun(self):
        history = [{"role": "user", "content": "Bước đầu tiên là gì"}]
        # "nó" + ngắn < 25 chars → score >= 2
        assert needs_rewrite("nó làm gì?", history=history) is True

    def test_clear_standalone_query(self):
        history = [{"role": "user", "content": "Bước đầu tiên là gì"}]
        query = "Quy trình phê duyệt ngân sách của công ty như thế nào?"
        assert needs_rewrite(query, history=history) is False

    def test_ambiguous_start_word(self):
        history = [{"role": "assistant", "content": "Đây là quy trình 5 bước"}]
        # "còn" + ngắn → score >= 2
        assert needs_rewrite("còn bước 3?", history=history) is True

    def test_contains_ambiguous_pronoun(self):
        history = [{"role": "user", "content": "Phân tích tài liệu"}]
        # "điều này" + ngắn → score >= 2
        assert needs_rewrite("điều này nghĩa là gì", history=history) is True
