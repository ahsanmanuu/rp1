%% standard.bst - Minimal placeholder
ENTRY { author title journal year volume number pages } {} { label }
FUNCTION {output.nonnull} { write$ newline$ }
FUNCTION {article} {
  author output.nonnull
  title output.nonnull
  journal output.nonnull
  year output.nonnull
}
READ
ITERATE { article }
