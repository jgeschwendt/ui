# Invariants

| claim | node | anchor |
| --- | --- | --- |
| every rule sits in ui.tokens, ui.base or ui.components, declared in that order before any rule | / | ※ tailwind-compatibility |
| :root declares every token; theme blocks only reassign | / | ※ theming-contract |
| ui.css is the whole library — no build step, no framework dependency, no network requests | / | ※ whole-library |
