# Character Motion Portfolio Prototype

A small static web prototype for a cursor-reactive character and a scroll-controlled transition into a dumbbell pose.

## Run locally

```sh
python3 -m http.server 4176
```

Then open <http://127.0.0.1:4176/>.

## Motion

- `assets/hero-motion/`: PNG sequence used for cursor-directed character frames.
- `assets/transition-b/`: PNG sequence scrubbed by scroll position.

The book/page-flip UI is not part of this prototype's current scope.
