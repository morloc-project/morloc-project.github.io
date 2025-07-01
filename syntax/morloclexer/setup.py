from setuptools import setup, find_packages

setup(
    name='morloclexer',
    packages=find_packages(),
    entry_points={
        'pygments.lexers': [
            'morloclexer = morloclexer.lexer:MorlocLexer',
        ]
    }
)
