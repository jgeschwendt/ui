# Invariants

| claim | node | anchor |
| --- | --- | --- |
| every rule sits in ui.tokens, ui.base or ui.components, declared in that order before any rule | / | README.md#tailwind-compatibility |
| :root declares every token; theme blocks only reassign | / | README.md#theming-contract |
| ui.css is the artifact — no build step, no dependency, no network request; every page loads it by relative path | / | README.md#ui |
