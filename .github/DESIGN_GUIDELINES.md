# Design guidelines

These guidelines keep Treegger's documentation and project artwork consistent.

## Color

| Role | Color | Use |
| --- | --- | --- |
| Brand green | `#208A60` | Tree symbol, standalone wordmark, buttons, focus indicators, and small accent areas |
| Light green | `#6FC69D` | Links and small accent text on dark backgrounds |
| Dark background | `#0B1210` | Documentation page background |
| Panel background | `#0E1913` | Navigation panels |
| Main text | `#FFFFFF` | Wordmark on dark backgrounds and prominent text |
| Body text | `#D8E2DC` | Documentation prose |
| Secondary text | `#AEBFB4` | Navigation, captions, and footer links |
| Code background | `#0E1914` | Code blocks with a distinct header and green border |

Use brand green for the symbol and wordmark when the logo must work without a background. The [standalone logo](../assets/treegger-readme.svg) has a transparent background. The documentation sidebar carries the logo.

Brand green has approximately 4.3:1 contrast on white and 4.4:1 on the documentation's dark background. It works for the large logo, but use light green or white for small text on dark backgrounds. Check contrast again when introducing another background color.

## Typography

- Use the Latin subset of Onest for body text, navigation, headings, and controls. The documentation is in English; other scripts use system fallbacks.
- Use Iosevka for inline code and code blocks. Give inline code a subtle green border and background; omit decorative backticks.
- Self-host font files from `docs/web/fonts/`; keep their SIL Open Font License notices alongside them. Sources: [Onest](https://github.com/simpals/onest) and [Iosevka](https://github.com/be5invis/Iosevka).

## Layout and interaction

- Keep page content readable at narrow widths; move the sidebar navigation into a native disclosure menu on small screens.
- Use visible focus indicators and descriptive link text.
- Keep secondary text readable; avoid reducing text opacity or using faint gray for navigation and footer links. Active navigation should have a visible background and outline.
- Keep navigation, headings, and page content available in the generated HTML without JavaScript.
- Keep hover effects subtle; the logo does not change color on hover.

The documentation site defines its Tailwind color tokens in `docs/web/input.css`. Change the tokens and both SVG logos together when updating the brand palette.
