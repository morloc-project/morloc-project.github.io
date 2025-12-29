from pygments.lexer import RegexLexer, bygroups, include
from pygments.token import *
from pygments import unistring as uni

#  Text        | Token.Text            | for any type of text data
#  Whitespace  | Token.Text.Whitespace | for whitespace
#  Error       | Token.Error           | represents lexer errors
#  Other       | Token.Other           | special token for data not matched by a parser (e.g. HTML markup in PHP code)
#  Keyword     | Token.Keyword         | any kind of keywords
#  Name        | Token.Name            | variable/function names
#  Literal     | Token.Literal         | Any literals
#  String      | Token.Literal.String  | string literals
#  Number      | Token.Literal.Number  | number literals
#  Operator    | Token.Operator        | operators (+, not…)
#  Punctuation | Token.Punctuation     | punctuation ([, (…)
#  Comment     | Token.Comment         | any kind of comments
#  Generic     | Token.Generic         | generic tokens (have a look at the explanation below)


class MorlocLexer(RegexLexer):
    name = "MorlocLexer"
    aliases = ["morloc"]
    filenames = ["*.mlc"]
    reserved = (
        "module",
        "source",
        "export",
        "import",
        "object",
        "table",
        "record",
        "type",
        "class",
        "instance",
        "where",
        "from",
        "as"
    )

    tokens = {
        "root": [
            ("where", Keyword.Reserved),
            (r"\s+", Whitespace),
            (r"--.*$", Comment.Single),
            (r"\{-", Comment.Multiline, "comment"),
            (r"\bmodule\b", Keyword.Reserved, "module"),
            (r"\bclass\b", Keyword.Reserved),
            (r"\binstance\b", Keyword.Reserved),

            (r"\bsource\b", Keyword.Reserved),
            (r"\bfrom\b", Keyword.Reserved),
            (r"\bas\b", Keyword.Reserved),
            (
                r"(\btype\b)(\s+)([A-Z][A-Za-z]*)",
                bygroups(
                    Keyword.Reserved,
                    Whitespace,
                    Name
                ),
            ),
            #
            (
                r"(\bimport\b)(\s+)([a-zA-Z.][\w-]+)",
                bygroups(Keyword.Reserved, Whitespace, Name),
            ),
            (
                r"(\bimport\b)(\()",
                bygroups(Keyword.Reserved, Punctuation),
                "importList",
            ),
            # general constructors
            (r"^(object|table|record)(\s+)", bygroups(Keyword.Reserved, Whitespace)),

            #  Pattern getters and setters
            # Match pattern syntax like .0, .name, .1.name, .(.0, .1), .(.0 = value)
            # Must be immediately followed by digit, letter, or opening paren (no whitespace)
            (r"\.(?=\d|[a-zA-Z_]|\()", Text, "pattern"),

            #  Identifiers
            (r"[" + uni.Ll + r"][\w']*", Name),
            (r"[" + uni.Lu + r"][\w']*", Name),
            (
                r"(')\[[^\]]*\]",
                Keyword.Type,
            ),  # tuples and lists get special treatment in GHC
            (r"(')\([^)]*\)", Keyword.Type),  # ..
            (r"(')[:!#$%&*+.\\/<=>?@^|~-]+", Keyword.Type),  # promoted type operators
            #  Operators
            (r"(<-|::|->|=>|=|_|\\|@)", Operator.Word),  # specials
            #  Numbers
            (r"0[xX]_*[\da-fA-F](_*[\da-fA-F])*_*[pP][+-]?\d(_*\d)*", Number.Float),
            (
                r"0[xX]_*[\da-fA-F](_*[\da-fA-F])*\.[\da-fA-F](_*[\da-fA-F])*"
                r"(_*[pP][+-]?\d(_*\d)*)?",
                Number.Float,
            ),
            (r"\d(_*\d)*_*[eE][+-]?\d(_*\d)*", Number.Float),
            (r"\d(_*\d)*\.\d(_*\d)*(_*[eE][+-]?\d(_*\d)*)?", Number.Float),
            (r"0[bB]_*[01](_*[01])*", Number.Bin),
            (r"0[oO]_*[0-7](_*[0-7])*", Number.Oct),
            (r"0[xX]_*[\da-fA-F](_*[\da-fA-F])*", Number.Hex),
            (r"\d(_*\d)*", Number.Integer),
            #  Character/String Literals
            (r'"""', String, "multiline_string"),  # Triple-quoted strings
            (r'"', String, "string"),
            #  Special
            (r"\[\]", Keyword.Type),
            (r"\(\)", Name.Builtin),
            (r"[][(),;`{}]", Punctuation),
        ],
        "comment": [
            (r"[^-{}]", Comment.Multiline),
            (r"\{-", Comment.Multiline, "#push"),
            (r"-\}", Comment.Multiline, "#pop"),
            (r"[-{}]", Comment.Multiline),
        ],
        "module": [
            (r"\s+", Whitespace),
            (r"[" + uni.Ll + r"][\w.]*", Name, "#pop"),
        ],
        "string": [
            (r'#\{', String.Interpol, "interpolation"),  # String interpolation
            (r'[^\\"#]+', String),
            (r'#(?!\{)', String),  # Hash not followed by brace
            (r"\\", String.Escape, "escape"),
            ('"', String, "#pop"),
        ],
        "multiline_string": [
            (r'#\{', String.Interpol, "interpolation"),  # String interpolation
            (r'[^"#]+', String),
            (r'#(?!\{)', String),  # Hash not followed by brace
            (r'"(?!"")', String),  # Single quote not part of triple
            (r'""(?!")', String),  # Double quote not part of triple
            (r'"""', String, "#pop"),  # Triple quote ends the string
        ],
        "expr": [
            # Common expression patterns that can be reused
            (r'\s+', Whitespace),
            # Operators
            (r'[+\-*/%<>=!&|^~]', Operator),
            (r'(<-|::|->|=>|=|_|\\|@)', Operator.Word),
            # Numbers
            (r"0[xX]_*[\da-fA-F](_*[\da-fA-F])*_*[pP][+-]?\d(_*\d)*", Number.Float),
            (
                r"0[xX]_*[\da-fA-F](_*[\da-fA-F])*\.[\da-fA-F](_*[\da-fA-F])*"
                r"(_*[pP][+-]?\d(_*\d)*)?",
                Number.Float,
            ),
            (r"\d(_*\d)*_*[eE][+-]?\d(_*\d)*", Number.Float),
            (r"\d(_*\d)*\.\d(_*\d)*(_*[eE][+-]?\d(_*\d)*)?", Number.Float),
            (r"0[bB]_*[01](_*[01])*", Number.Bin),
            (r"0[oO]_*[0-7](_*[0-7])*", Number.Oct),
            (r"0[xX]_*[\da-fA-F](_*[\da-fA-F])*", Number.Hex),
            (r"\d(_*\d)*", Number.Integer),
            # Strings
            (r'"""', String, "multiline_string"),
            (r'"', String, "string"),
            # Identifiers
            (r"[" + uni.Ll + r"][\w']*", Name),
            (r"[" + uni.Lu + r"][\w']*", Name),
            # Punctuation
            (r'[(){}\[\],;]', Punctuation),
        ],
        
        "interpolation": [
            (r'\}', String.Interpol, "#pop"),  # End interpolation
            (r'\{', Punctuation, "#push"),  # Nested braces
            include("expr")
        ],
        "escape": [
            (r'[abfnrtv"\'&\\]', String.Escape, "#pop"),
            (r"\^[][" + uni.Lu + r"@^_]", String.Escape, "#pop"),
            (r"o[0-7]+", String.Escape, "#pop"),
            (r"x[\da-fA-F]+", String.Escape, "#pop"),
            (r"\d+", String.Escape, "#pop"),
            (r"(\s+)(\\)", bygroups(Whitespace, String.Escape), "#pop"),
        ],
        "sourcelist": [
            (r"\s+", Whitespace),
            (r"\(", Text, "#push"),
            (r"\)", Text, "#pop"),
            (r"\"[^\"]+\"", String),
            (r",", Punctuation),
            (
                r'("[^"]+")(\s+)(as)(\s+)([\w]+)',
                bygroups(String, Whitespace, Keyword.Reserved, Whitespace, Name),
            ),
        ],
        "importList": [
            (r"\s+", Whitespace),
            (r"\(", Text, "#push"),
            (r"\)", Text, "#pop"),
            (r"[A-Za-z][\w]*", Name),
            (r",", Punctuation),
        ],
        
        "pattern": [
            # Nested pattern with parentheses: .(...) 
            (r"\(", Text, "pattern_group"),
            # Field access by name: .name
            (r"[a-z_][\w]*", Text, "#pop"),
            # Tuple index access: .0, .1, etc.
            (r"\d+", Text, "#pop"),
            # Chained pattern: continue with another dot
            (r"\.", Text, "#push"),
            # End of pattern
            (r"", Text, "#pop"),
        ],
        
        "pattern_group": [
            (r"\s+", Whitespace),
            # Start of nested pattern
            (r"\.", Text, "pattern"),
            # Assignment in pattern: = followed by expression
            (r"=", Text, "pattern_value"),
            # Comma separating multiple patterns
            (r",", Text),
            # End of pattern group
            (r"\)", Text, "#pop"),
        ],
        
        "pattern_value": [
            # End pattern value on comma or closing paren
            (r"(?=[,)])", Text, "#pop"),
            include("expr"),
            # Handle nested parentheses explicitly for pattern value context
            (r"\(", Text, "#push"),
            (r"\)", Text, "#pop"),
        ],
    }
