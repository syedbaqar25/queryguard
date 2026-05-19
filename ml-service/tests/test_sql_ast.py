import pytest

from src.model.sql_ast import ASTFeatureExtractor, ASTScorer, SQLLexer, TokenType


@pytest.fixture
def lex():
    return SQLLexer()


@pytest.fixture
def ext():
    return ASTFeatureExtractor()


@pytest.fixture
def sc():
    return ASTScorer()


def test_keywords(lex):
    kws = [t.value.upper() for t in lex.tokenize("SELECT * FROM users") if t.type == TokenType.KEYWORD]
    assert "SELECT" in kws and "FROM" in kws


def test_line_comment(lex):
    c = [t for t in lex.tokenize("SELECT 1--x") if t.type == TokenType.COMMENT]
    assert len(c) == 1 and "--x" in c[0].value


def test_block_comment(lex):
    assert len([t for t in lex.tokenize("S/**/1") if t.type == TokenType.COMMENT]) == 1


def test_string_literal(lex):
    assert len([t for t in lex.tokenize("WHERE n='admin'") if t.type == TokenType.STRING_LITERAL]) == 1


def test_hex_literal(lex):
    nums = [t for t in lex.tokenize("0x61646d") if t.type == TokenType.NUMBER]
    assert any("0x" in t.value.lower() for t in nums)


def test_union_count(ext):
    assert ext.extract("' UNION SELECT 1--").union_count == 1


def test_tautology(ext):
    f = ext.extract("' OR 1=1--")
    assert f.tautology_present and f.always_true_condition


def test_time_function(ext):
    assert ext.extract("'; SELECT SLEEP(5)--").time_function_present


def test_stacked_query(ext):
    assert ext.extract("1; DROP TABLE x--").stacked_query_count >= 1


def test_hex_feature(ext):
    assert ext.extract("SELECT 0x61646d FROM t").hex_literal_present


def test_char_function(ext):
    assert ext.extract("SELECT CHAR(65,66)").char_function_present


def test_comment_count(ext):
    assert ext.extract("S/*a*/1/*b*/").comment_count == 2


def test_vector_length(ext):
    assert len(ext.extract("SELECT 1").to_vector()) == 12


def test_safe_low_score(ext, sc):
    assert sc.score(ext.extract("SELECT name FROM users WHERE id=1")) < 0.3


def test_injection_high_score(ext, sc):
    assert sc.score(ext.extract("' UNION SELECT username,password FROM users--")) > 0.5
