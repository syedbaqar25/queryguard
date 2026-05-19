"""SQL lexer from scratch — 12-feature AST extractor for structural signals."""
import re
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


class TokenType(Enum):
    KEYWORD = "KEYWORD"
    IDENTIFIER = "IDENTIFIER"
    STRING_LITERAL = "STRING_LITERAL"
    NUMBER = "NUMBER"
    OPERATOR = "OPERATOR"
    COMMENT = "COMMENT"
    PUNCTUATION = "PUNCTUATION"
    WHITESPACE = "WHITESPACE"
    UNKNOWN = "UNKNOWN"


SQL_KEYWORDS: set[str] = {
    "SELECT", "FROM", "WHERE", "AND", "OR", "NOT", "IN", "IS", "NULL",
    "INSERT", "INTO", "VALUES", "UPDATE", "SET", "DELETE", "CREATE",
    "TABLE", "DROP", "ALTER", "INDEX", "VIEW", "UNION", "ALL", "DISTINCT",
    "JOIN", "INNER", "LEFT", "RIGHT", "OUTER", "ON", "AS", "GROUP", "BY",
    "ORDER", "HAVING", "LIMIT", "OFFSET", "LIKE", "BETWEEN", "EXISTS",
    "CASE", "WHEN", "THEN", "ELSE", "END", "WITH", "RECURSIVE",
    "PRIMARY", "KEY", "FOREIGN", "REFERENCES", "CONSTRAINT",
    "EXEC", "EXECUTE", "DECLARE", "BEGIN", "COMMIT", "ROLLBACK",
    "GRANT", "REVOKE", "TRUNCATE", "PROCEDURE", "FUNCTION", "TRIGGER",
    "DATABASE", "SCHEMA", "SHOW", "DESCRIBE", "EXPLAIN", "TOP",
}

DANGEROUS_KEYWORDS: set[str] = {
    "UNION", "DROP", "EXEC", "EXECUTE", "XP_CMDSHELL", "SLEEP",
    "WAITFOR", "BENCHMARK", "LOAD_FILE", "INTO_OUTFILE", "UTL_HTTP",
    "DUMPFILE", "EXTRACTVALUE", "UPDATEXML",
}


@dataclass
class Token:
    type: TokenType
    value: str
    position: int


@dataclass
class ASTFeatures:
    union_count: int = 0
    comment_count: int = 0
    tautology_present: bool = False
    dangerous_keyword_count: int = 0
    stacked_query_count: int = 0
    subquery_depth: int = 0
    string_comparison_count: int = 0
    hex_literal_present: bool = False
    char_function_present: bool = False
    time_function_present: bool = False
    always_true_condition: bool = False
    quote_count: int = 0

    def to_vector(self) -> list[float]:
        return [
            min(self.union_count / 3.0, 1.0),
            min(self.comment_count / 5.0, 1.0),
            float(self.tautology_present),
            min(self.dangerous_keyword_count / 5.0, 1.0),
            min(self.stacked_query_count / 3.0, 1.0),
            min(self.subquery_depth / 5.0, 1.0),
            min(self.string_comparison_count / 3.0, 1.0),
            float(self.hex_literal_present),
            float(self.char_function_present),
            float(self.time_function_present),
            float(self.always_true_condition),
            min(self.quote_count / 10.0, 1.0),
        ]


class SQLLexer:
    def tokenize(self, query: str) -> list[Token]:
        tokens: list[Token] = []
        i = 0
        n = len(query)

        while i < n:
            # Line comment --
            if i + 1 < n and query[i] == "-" and query[i + 1] == "-":
                start = i
                while i < n and query[i] != "\n":
                    i += 1
                tokens.append(Token(TokenType.COMMENT, query[start:i], start))
                continue

            # Block comment /* ... */
            if i + 1 < n and query[i] == "/" and query[i + 1] == "*":
                start = i
                i += 2
                while i + 1 < n and not (query[i] == "*" and query[i + 1] == "/"):
                    i += 1
                i += 2
                tokens.append(Token(TokenType.COMMENT, query[start:i], start))
                continue

            # Hash comment
            if query[i] == "#":
                start = i
                while i < n and query[i] != "\n":
                    i += 1
                tokens.append(Token(TokenType.COMMENT, query[start:i], start))
                continue

            # String literal (single quote)
            if query[i] == "'":
                start = i
                i += 1
                while i < n:
                    if query[i] == "'" and i + 1 < n and query[i + 1] == "'":
                        i += 2
                    elif query[i] == "\\" and i + 1 < n:
                        i += 2
                    elif query[i] == "'":
                        i += 1
                        break
                    else:
                        i += 1
                tokens.append(Token(TokenType.STRING_LITERAL, query[start:i], start))
                continue

            # Hex literal (0x...)
            if query[i] == "0" and i + 1 < n and query[i + 1].lower() == "x":
                start = i
                i += 2
                while i < n and query[i] in "0123456789abcdefABCDEF":
                    i += 1
                tokens.append(Token(TokenType.NUMBER, query[start:i], start))
                continue

            # Number
            if query[i].isdigit():
                start = i
                while i < n and (query[i].isdigit() or query[i] == "."):
                    i += 1
                tokens.append(Token(TokenType.NUMBER, query[start:i], start))
                continue

            # Whitespace (coalesced)
            if query[i] in " \t\n\r":
                start = i
                while i < n and query[i] in " \t\n\r":
                    i += 1
                tokens.append(Token(TokenType.WHITESPACE, query[start:i], start))
                continue

            # Identifiers and keywords
            if query[i].isalpha() or query[i] == "_":
                start = i
                while i < n and (query[i].isalnum() or query[i] in "_$."):
                    i += 1
                word = query[start:i]
                ttype = (
                    TokenType.KEYWORD
                    if word.upper() in SQL_KEYWORDS
                    else TokenType.IDENTIFIER
                )
                tokens.append(Token(ttype, word, start))
                continue

            # Operators
            if query[i] in "=<>!":
                start = i
                two = query[i : i + 2]
                if two in ("<>", "!=", ">=", "<="):
                    tokens.append(Token(TokenType.OPERATOR, two, i))
                    i += 2
                else:
                    tokens.append(Token(TokenType.OPERATOR, query[i], i))
                    i += 1
                continue

            # Punctuation
            if query[i] in "(),;":
                tokens.append(Token(TokenType.PUNCTUATION, query[i], i))
                i += 1
                continue

            tokens.append(Token(TokenType.UNKNOWN, query[i], i))
            i += 1

        return tokens


_STACKED_RE = re.compile(r";\s*(SELECT|INSERT|UPDATE|DELETE|DROP|EXEC|EXECUTE)\b", re.IGNORECASE)
_HEX_RE = re.compile(r"0x[0-9a-fA-F]+")
_CHAR_RE = re.compile(r"\bCHAR\s*\(", re.IGNORECASE)
_TIME_RE = re.compile(r"\b(SLEEP|WAITFOR|BENCHMARK)\s*\(", re.IGNORECASE)
_STR_CMP_RE = re.compile(r"'[^']*'\s*=\s*'[^']*'")
_TAUTOLOGY_OR = re.compile(r"OR\s+1\s*=\s*1", re.IGNORECASE)
_TAUTOLOGY_QQ = re.compile(r"'[^']+'\s*=\s*'[^']+'")
_NN_RE = re.compile(r"\b(\d+)\s*=\s*\1\b")


class ASTFeatureExtractor:
    def extract(self, query: str) -> ASTFeatures:
        try:
            return self._extract_unsafe(query)
        except Exception:
            return ASTFeatures()

    def _extract_unsafe(self, query: str) -> ASTFeatures:
        lexer = SQLLexer()
        tokens = lexer.tokenize(query)

        union_count = sum(
            1 for t in tokens if t.type == TokenType.KEYWORD and t.value.upper() == "UNION"
        )
        comment_count = sum(1 for t in tokens if t.type == TokenType.COMMENT)

        tautology = bool(
            _TAUTOLOGY_OR.search(query)
            or _TAUTOLOGY_QQ.search(query)
            or _NN_RE.search(query)
            or re.search(r"OR\s+'[^']*'\s*=\s*'[^']*'", query, re.IGNORECASE)
        )
        always_true = tautology

        dangerous_count = sum(
            1
            for t in tokens
            if t.type in (TokenType.KEYWORD, TokenType.IDENTIFIER)
            and t.value.upper() in DANGEROUS_KEYWORDS
        )

        stacked_count = len(_STACKED_RE.findall(query))

        depth = max_depth = 0
        for ch in query:
            if ch == "(":
                depth += 1
                max_depth = max(max_depth, depth)
            elif ch == ")":
                depth = max(depth - 1, 0)

        quote_count = query.count("'") + query.count('"')

        return ASTFeatures(
            union_count=union_count,
            comment_count=comment_count,
            tautology_present=tautology,
            dangerous_keyword_count=dangerous_count,
            stacked_query_count=stacked_count,
            subquery_depth=max_depth,
            string_comparison_count=len(_STR_CMP_RE.findall(query)),
            hex_literal_present=bool(_HEX_RE.search(query)),
            char_function_present=bool(_CHAR_RE.search(query)),
            time_function_present=bool(_TIME_RE.search(query)),
            always_true_condition=always_true,
            quote_count=quote_count,
        )


class ASTScorer:
    WEIGHTS = {
        "union_count": 0.15,
        "comment_count": 0.08,
        "tautology_present": 0.12,
        "dangerous_keyword_count": 0.15,
        "stacked_query_count": 0.12,
        "subquery_depth": 0.05,
        "string_comparison_count": 0.08,
        "hex_literal_present": 0.07,
        "char_function_present": 0.06,
        "time_function_present": 0.07,
        "always_true_condition": 0.10,
        "quote_count": 0.05,
    }

    def score(self, features: ASTFeatures) -> float:
        vec = features.to_vector()
        weights = list(self.WEIGHTS.values())
        total = sum(v * w for v, w in zip(vec, weights))
        return min(max(total, 0.0), 1.0)
